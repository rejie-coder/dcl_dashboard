export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const GROUPS = ['Activity & patient flow','Medical conditions','Surgery & procedures','Maternity & reproductive health','Injuries & external causes','Mortality','Other indicators'];
export type HospitalRow = { name: string; year: number; values: (number|null)[] };
export type IndicatorConfig = { group: string; unit: string; rollup: 'sum'|'mean'; target: number|null; direction: 'neutral'|'higher'|'lower'; favorite: boolean };
export type ImportResult = { rows: HospitalRow[]; warnings: string[]; errors: string[]; duplicates: number };
export function groupFor(name: string): string {
 if (/death|mortality/i.test(name)) return GROUPS[5];
 if (/lscs|lrt|gyn|obs|maternity|birth|delivery/i.test(name)) return GROUPS[3];
 if (/assault|burn|bite|drown|gunshot|poison|rta|stab|injur/i.test(name)) return GROUPS[4];
 if (/admission|discharg|clinic|inpatient|mid night|transfer|opd/i.test(name)) return GROUPS[0];
 if (/surg|laparosc|laperosc|amput/i.test(name)) return GROUPS[2];
 return GROUPS[1];
}
export const defaultConfig = (name: string): IndicatorConfig => ({group: groupFor(name), unit:'count', rollup:'sum', target:null, direction:'neutral', favorite:false});
const normalize = (s: string) => s.replace(/^\uFEFF/,'').trim().toLowerCase();
export function normalizeHospitalRows(input: Record<string,unknown>[]): ImportResult {
 const rows: HospitalRow[]=[]; const warnings:string[]=[]; const errors:string[]=[]; let duplicates=0;
 const candidates: (HospitalRow & { suffix: boolean; line:number })[]=[];
 input.forEach((raw,i)=>{
  const r = Object.fromEntries(Object.entries(raw).map(([k,v])=>[normalize(k),v]));
  const year=Number(r.year); const code=String(r.code || r.indicator || r.category || '').trim();
  if (!code || !Number.isInteger(year) || year<1900 || year>2200) {errors.push(`Row ${i+2}: indicator/code and a valid Year are required.`);return;}
  let name=code; const end=new RegExp(`\\s*${year}$`); while(end.test(name)) name=name.replace(end,'').trim();
  if (!name) {errors.push(`Row ${i+2}: empty indicator name.`);return;}
  const values=MONTHS.map(m=>{
   const key=Object.keys(r).find(k=>k===m.toLowerCase() || k===new Date(2000,MONTHS.indexOf(m),1).toLocaleString('en',{month:'long'}).toLowerCase());
   if (!key) {errors.push(`Row ${i+2}: missing ${m} column.`);return null;}
   const v=r[key]; if(v===null || v===undefined || String(v).trim()==='')return null;
   const n=Number(String(v).replace(/,/g,''));
   if (!Number.isFinite(n) || n<0) {errors.push(`Row ${i+2}, ${m}: expected a non-negative number or blank.`); return null;}
   return n;
  });
  candidates.push({name,year,values,suffix:name!==code,line:i+2});
 });
 candidates.sort((a,b)=>Number(a.suffix)-Number(b.suffix));
 for(const r of candidates){
  const prior=rows.find(p=>p.name.toLowerCase()===r.name.toLowerCase()&&p.year===r.year);
  if(prior){
   if(r.values.every((v,i)=>v===prior.values[i]) || (r.suffix && r.values.every(v=>v===0||v===null))){duplicates++;continue;}
   errors.push(`Row ${r.line}: conflicting duplicate for ${r.name}, ${r.year}. Resolve it before importing.`);continue;
  }
  rows.push({name:r.name,year:r.year,values:r.values});
 }
 if(duplicates)warnings.push(`${duplicates} repeated indicator/year rows excluded (identical duplicates or year-suffixed empty copies).`);
 const trailing=rows.filter(r=>r.values.at(-1)===0).length;
 if(trailing)warnings.push(`${trailing} rows end in zero. Zeros remain valid observations unless you explicitly choose to exclude trailing zeros.`);
 warnings.push('Source Total and Alert Status are not imported; totals and flags are recalculated from monthly values.');
 return {rows:rows.sort((a,b)=>a.name.localeCompare(b.name)||a.year-b.year),warnings,errors,duplicates};
}
export type Point={ year:number; month:number; value:number|null; flags:string[] };
export function pointsFor(rows:HospitalRow[], trailingMissing:boolean):Point[]{
 return [...rows].sort((a,b)=>a.year-b.year).flatMap(r=>{
  let last=11; if(trailingMissing)while(last>=0&&(r.values[last]===0||r.values[last]===null))last--;
  return r.values.map((v,month)=>({year:r.year,month,value:month>last?null:v,flags:[]}));
 });
}
export function statistics(values:number[]){
 const n=values.length, sum=values.reduce((a,b)=>a+b,0),mean=n?sum/n:null;
 const sorted=[...values].sort((a,b)=>a-b);
 return {n,sum,mean,median:n?(sorted[Math.floor(n/2)]+sorted[Math.ceil(n/2)-1])/2:null,sd:n>1?Math.sqrt(values.reduce((s,v)=>s+(v-mean!)**2,0)/(n-1)):null};
}
export function analyze(points:Point[], baseline:Point[], method:'sd'|'imr', k:number, trend:number){
 const stats=statistics(baseline.flatMap(p=>p.value===null?[]:[p.value]));
 const mr=baseline.flatMap((p,i)=>i&&p.value!==null&&baseline[i-1].value!==null&&p.year*12+p.month===baseline[i-1].year*12+baseline[i-1].month+1?[Math.abs(p.value-baseline[i-1].value!)]:[]);
 const sigma=method==='imr'?(mr.length?mr.reduce((a,b)=>a+b,0)/mr.length/1.128:null):stats.sd;
 const valid=stats.n>=2&&sigma!==null;
 const cl=stats.mean, upper=valid?cl!+k*sigma!:null, lower=valid?Math.max(0,cl!-k*sigma!):null;
 const marked=points.map((p,i)=>{
  const flags:string[]=[];
  if(p.value===null||!valid)return {...p,flags};
  if(p.value>upper!)flags.push('Above upper limit'); if(p.value<lower!)flags.push('Below lower limit');
  const window=(n:number)=>{const w=points.slice(Math.max(0,i-n+1),i+1);return w.length===n&&w.every((q,j)=>q.value!==null&&(!j||q.year*12+q.month===w[j-1].year*12+w[j-1].month+1))?w:[];};
  const shift=window(8); if(shift.length&&(shift.every(q=>q.value!>cl!)||shift.every(q=>q.value!<cl!)))flags.push('8-point shift');
  const t=window(trend);if(t.length&&(t.every((q,j)=>!j||q.value!>t[j-1].value!)||t.every((q,j)=>!j||q.value!<t[j-1].value!)))flags.push(`${trend}-point trend`);
  return {...p,flags};
 });
 return {points:marked,cl,upper,lower,sigma,baselineN:stats.n};
}
