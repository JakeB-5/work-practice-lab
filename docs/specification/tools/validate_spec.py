#!/usr/bin/env python3
"""Validate this specification pack; this does not test the application."""
import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path
from jsonschema import Draft202012Validator, Draft7Validator, FormatChecker
from openapi_spec_validator import validate as validate_openapi

ROOT = Path(__file__).resolve().parents[1]

def read_json(relative):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def expect_db_error(db, statement, args=()):
    try:
        db.execute(statement, args)
    except sqlite3.DatabaseError:
        return
    raise AssertionError("Expected SQL rejection: " + statement)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codex-schema", type=Path, help="Locally generated experimental ClientRequest.json")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    results = {}
    schema = read_json("contracts/domain.schema.json")
    Draft202012Validator.check_schema(schema)
    terminal = read_json("contracts/terminal.schema.json")
    Draft202012Validator.check_schema(terminal)
    fixtures = read_json("fixtures/contract-cases.json")
    for case in fixtures["cases"]:
        target = {"$schema": schema["$schema"], "$defs": schema["$defs"],
                  "$ref": "#/$defs/" + case["schema"]}
        errors = list(Draft202012Validator(target, format_checker=FormatChecker()).iter_errors(case["data"]))
        require((not errors) == case["valid"], case["name"] + ": " + "; ".join(e.message for e in errors[:3]))
    results["jsonSchema"] = {"definitions": len(schema["$defs"]), "fixtureCases": len(fixtures["cases"]), "status": "passed"}

    api = read_json("contracts/openapi.json")
    validate_openapi(api)
    expected_components = json.loads(json.dumps(schema["$defs"]).replace("#/$defs/", "#/components/schemas/"))
    require(api["components"]["schemas"] == expected_components, "OpenAPI/domain schemas drifted")
    operation_ids = []
    for item in api["paths"].values():
        for method, op in item.items():
            if method in ("get", "post", "put", "patch", "delete", "head", "options"):
                operation_ids.append(op["operationId"])
    require(len(operation_ids) == len(set(operation_ids)), "Duplicate operationId")
    results["openapi"] = {"version": api["openapi"], "operations": len(operation_ids), "status": "passed"}

    db = sqlite3.connect(":memory:")
    db.executescript((ROOT / "contracts/storage.sql").read_text(encoding="utf-8"))
    db.execute("INSERT INTO scenario_versions VALUES (?,?,?,?,?,?,?)",
               ("scv", "sample", "0.1.0", "a"*64, "{}", "private/sample", "2026-10-30"))
    insert_attempt = """INSERT INTO attempts
      (id,scenario_version_id,mode,execution_mode,state,version,duration_seconds,
       runtime_snapshot_json,workspace_root,created_at,updated_at)
       VALUES (?, 'scv','exam','replay','ready',1,7200,'{}',?,'2026-10-30','2026-10-30')"""
    db.execute(insert_attempt, ("att1", "workspace/att1"))
    expect_db_error(db, insert_attempt, ("att2", "workspace/att2"))
    db.execute("UPDATE attempts SET state='completed' WHERE id='att1'")
    db.execute(insert_attempt, ("att2", "workspace/att2"))
    expect_db_error(db, "UPDATE attempts SET state='bogus' WHERE id='att2'")
    db.execute("INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)",
               ("sub1","att1","t1","t2",10,"a"*64,"submissions/sub1","{}","[]"))
    expect_db_error(db, "UPDATE submissions SET manifest_hash='changed' WHERE id='sub1'")
    db.execute("INSERT INTO interviews VALUES (?,?,?,?,?,?,?)",
               ("int1","sub1",1,"finalized","[]","t1","t2"))
    db.execute("""INSERT INTO evaluations
       (id,submission_id,interview_id,version,state,rubric_version,model,prompt_version,condition_json,created_at)
       VALUES ('eva1','sub1','int1',1,'completed','0.1.0','fixture','0.1.0','[]','t1')""")
    expect_db_error(db, "UPDATE evaluations SET model='changed' WHERE id='eva1'")
    tables = db.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    results["storage"] = {"tables": tables, "checks": ["DDL", "one_active_attempt", "state_enum", "immutable_submission", "immutable_completed_evaluation"], "status": "passed"}
    db.close()

    registry = read_json("tasks/tasks.json")
    tasks = registry["tasks"]
    by_id = {t["id"]: t for t in tasks}
    require(len(tasks) == 98 == len(by_id), "Task ID/count mismatch")
    visiting, visited = set(), set()
    def visit(task_id):
        require(task_id not in visiting, "Dependency cycle: " + task_id)
        if task_id in visited:
            return
        visiting.add(task_id)
        for dep in by_id[task_id]["deps"]:
            require(dep in by_id, "Missing dependency: " + dep)
            visit(dep)
        visiting.remove(task_id)
        visited.add(task_id)
    for task in tasks:
        visit(task["id"])
        for ref in task["specRefs"]:
            require((ROOT / ref).is_file(), "Missing task spec: " + ref)
        require(task["plannedPaths"], "Missing planned paths")
        require(task["verificationPlan"], "Missing verification plan")
        require(set(task["apiOperationIds"]) <= set(operation_ids), "Unknown API operation in " + task["id"])
    def ancestors(task_id, collected=None):
        collected = set() if collected is None else collected
        for dep in by_id[task_id]["deps"]:
            if dep not in collected:
                collected.add(dep)
                ancestors(dep, collected)
        return collected
    release = ancestors("T14.05") | {"T14.05"}
    p0 = {t["id"] for t in tasks if t["priority"] == "P0"}
    require(len(p0) == 90 and p0 <= release, "Release does not cover all P0 tasks")
    for task in tasks:
        wave = int(task["parallelWave"][1:])
        require(all(int(by_id[d]["parallelWave"][1:]) < wave for d in task["deps"]), "Invalid parallel wave " + task["id"])
        if task["satisfiesDependencies"]:
            require(all(by_id[d]["satisfiesDependencies"] for d in task["deps"]), "Completed dependency mismatch")
        ready = not task["satisfiesDependencies"] and all(by_id[d]["satisfiesDependencies"] for d in task["deps"])
        require(task["readyNow"] == ready, "Incorrect readiness " + task["id"])
    mapping = read_json("tasks/acceptance-map.json")
    require({f["id"] for f in mapping["features"]} == {f"F{i:02d}" for i in range(1,19)}, "Feature map incomplete")
    require({a["id"] for a in mapping["acceptance"]} == {f"A{i:02d}" for i in range(1,23)}, "Acceptance map incomplete")
    for item in mapping["acceptance"]:
        require(set(item["taskIds"]) <= set(by_id), "Unknown acceptance task")
    results["tasks"] = {"epics": len({t["epicId"] for t in tasks}), "tasks": len(tasks), "p0": len(p0), "features": 18, "acceptanceTests": 22, "status": "passed"}

    for case in fixtures["cases"]:
        if case["schema"] != "Evaluation" or not case["valid"]:
            continue
        evaluation = case["data"]
        computed = {}
        assessed = 0
        for axis in ("technology", "intent", "cognition"):
            js = [j for j in evaluation["judgments"] if j["axis"] == axis]
            require(len(js) == 4, "Fixture criterion count")
            assessed += sum(j["status"] == "rated" for j in js)
            computed[axis] = sum(j["rating"] for j in js)/16*100 if all(j["status"] == "rated" for j in js) else None
        total = sum(computed.values()) if all(v is not None for v in computed.values()) else None
        require(evaluation["scores"] == dict(computed, total=total, assessedCount=assessed), "Fixture score mismatch")
    results["scoreFixtures"] = "passed"

    broken_links = []
    for path in ROOT.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        require(text.count("~~~") % 2 == 0, "Unbalanced fence: " + str(path))
        for link in re.findall(r"\]\(([^)]+)\)", text):
            if link.startswith(("https://","http://","#","mailto:")):
                continue
            target = link.split("#",1)[0].strip("<>")
            if target and not (path.parent / target).exists():
                broken_links.append((str(path.relative_to(ROOT)), target))
    require(not broken_links, "Broken links: " + str(broken_links))
    results["markdownLinks"] = "passed"

    if args.codex_schema:
        wire = json.loads(args.codex_schema.read_text(encoding="utf-8"))
        validator = Draft7Validator(wire)
        count = 0
        for message in read_json("contracts/codex-requests.json")["messages"]:
            if "id" not in message:
                continue
            errors = list(validator.iter_errors(message))
            require(not errors, "Wire example invalid: " + message["method"])
            count += 1
        results["codexWire"] = {"requests":count, "schemaSha256":hashlib.sha256(args.codex_schema.read_bytes()).hexdigest(), "status":"passed"}
    else:
        results["codexWire"] = {"status":"not_run", "reason":"Provide --codex-schema from the installed CLI to repeat wire validation"}
    results["applicationImplementation"] = "not_run"
    results["liveCodexInference"] = "not_run"
    results["runtimePermissionEnforcement"] = "not_run"
    report = {"checkedDate":"2026-10-30", "scope":"Specification, contract and planning consistency only", "results":results}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
