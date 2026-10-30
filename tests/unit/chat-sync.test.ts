import {afterEach,it,expect,vi} from 'vitest';
import {snapshotSync} from '../../apps/web/src/chat-sync';
afterEach(()=>vi.useRealTimers());
it('recovers a completed reply without any event notification',async()=>{
 vi.useFakeTimers();let completed=false;const publish=vi.fn();
 const sync=snapshotSync(async()=>completed?'completed':'streaming',publish,vi.fn());
 await sync.refresh();completed=true;await vi.advanceTimersByTimeAsync(3000);
 expect(publish.mock.calls.map(call=>call[0])).toEqual(['streaming','completed']);sync.stop();
});
it('serializes event bursts instead of letting stale fetches win a race',async()=>{
 vi.useFakeTimers();let resolve!:(value:string)=>void;const publish=vi.fn();
 const load=vi.fn().mockImplementationOnce(()=>new Promise<string>(r=>resolve=r)).mockResolvedValue('completed');
 const sync=snapshotSync(load,publish,vi.fn());const first=sync.refresh();
 await sync.refresh();await sync.refresh();expect(load).toHaveBeenCalledTimes(1);
 resolve('streaming');await first;await Promise.resolve();
 expect(load).toHaveBeenCalledTimes(2);expect(publish).toHaveBeenLastCalledWith('completed');sync.stop();
});
it('ignores responses after switching roles and retries transient errors',async()=>{
 vi.useFakeTimers();let resolve!:(value:string)=>void;const publish=vi.fn(),fail=vi.fn();
 const stopped=snapshotSync(()=>new Promise<string>(r=>resolve=r),publish,fail);const work=stopped.refresh();stopped.stop();resolve('old role');await work;expect(publish).not.toHaveBeenCalled();
 const load=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('recovered');
 const retry=snapshotSync(load,publish,fail);await retry.refresh();await vi.advanceTimersByTimeAsync(3000);
 expect(fail).toHaveBeenCalledTimes(1);expect(publish).toHaveBeenLastCalledWith('recovered');retry.stop();
});
