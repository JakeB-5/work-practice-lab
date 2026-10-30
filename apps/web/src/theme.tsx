import React,{createContext,useContext,useEffect,useState,useCallback} from 'react';
export type ThemePreference='system'|'light'|'dark';
const key='wpl:theme';
const ThemeContext=createContext({preference:'system' as ThemePreference,resolved:'light' as 'light'|'dark',setPreference:(_value:ThemePreference)=>{}});
function readPreference():ThemePreference{try{const v=localStorage.getItem(key);return v==='light'||v==='dark'?v:'system';}catch{return 'system';}}
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [preference,updatePreference]=useState<ThemePreference>(readPreference),[systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
 const resolved=preference==='system'?(systemDark?'dark':'light'):preference;
 useEffect(()=>{const query=matchMedia('(prefers-color-scheme: dark)'),change=()=>setSystemDark(query.matches);query.addEventListener('change',change);const storage=(e:StorageEvent)=>{if(e.key===key)updatePreference(readPreference());};window.addEventListener('storage',storage);return()=>{query.removeEventListener('change',change);window.removeEventListener('storage',storage);};},[]);
 useEffect(()=>{document.documentElement.dataset.theme=resolved;},[resolved]);
 const setPreference=useCallback((value:ThemePreference)=>{updatePreference(value);try{localStorage.setItem(key,value);}catch{}},[]);
 return <ThemeContext.Provider value={{preference,resolved,setPreference}}>{children}</ThemeContext.Provider>;
}
export const useTheme=()=>useContext(ThemeContext);
export function ThemeChoice(){const {preference,setPreference}=useTheme();return <label className="theme-choice"><span>화면 테마</span><select aria-label="화면 테마" value={preference} onChange={e=>setPreference(e.target.value as ThemePreference)}><option value="system">시스템</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>;}
