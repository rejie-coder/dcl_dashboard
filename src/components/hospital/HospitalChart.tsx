import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS,CategoryScale,LinearScale,PointElement,LineElement,BarElement,Tooltip,Legend } from 'chart.js';
import { MONTHS, statistics } from '@/lib/hospital/model';
import type { Point, IndicatorConfig } from '@/lib/hospital/model';
ChartJS.register(CategoryScale,LinearScale,PointElement,LineElement,BarElement,Tooltip,Legend);
const COLORS=['#2475c5','#179776','#8957c7','#d78922','#d14870'];
export const fmt=(n:number|null|undefined)=>n===null||n===undefined?'—':n.toLocaleString('en-US',{maximumFractionDigits:1});
export function HospitalChart({points,mode,limits,config,show,chartRef}:{points:Point[];mode:string;limits:{cl:number|null;upper:number|null;lower:number|null};config:IndicatorConfig;show:string[];chartRef:React.RefObject<ChartJS<'line'>|null>}){
 const compare=mode!=='chronological', cumulative=mode==='cumulative';
 const years=[...new Set(points.map(p=>p.year))];
 const months=[...new Set(points.map(p=>p.month))].sort((a,b)=>a-b);
 const labels=compare?months.map(m=>MONTHS[m]):points.map(p=>`${MONTHS[p.month]} ${p.year}`);
 const groups=compare?years.map(y=>points.filter(p=>p.year===y)):[points];
 const datasets=groups.map((ps,i)=>{
  let total=0;
  return {label:compare?String(years[i]):'Observed',data:ps.map(p=>{if(p.value===null)return null;total+=p.value;return cumulative?total:p.value;}),borderColor:COLORS[i%COLORS.length],backgroundColor:COLORS[i%COLORS.length],borderWidth:2.5,tension:0,spanGaps:false,
  pointRadius:ps.map(p=>!cumulative&&p.flags.length?7:4),pointStyle:ps.map(p=>!cumulative&&p.flags.some(f=>f.includes('limit'))?'rectRot' as const:!cumulative&&p.flags.length?'triangle' as const:'circle' as const),
  pointBackgroundColor:ps.map(p=>!cumulative&&p.flags.some(f=>f.startsWith('Above'))?'#d54045':!cumulative&&p.flags.some(f=>f.startsWith('Below'))?'#2163d1':!cumulative&&p.flags.length?'#d89317':COLORS[i%COLORS.length]),pointBorderColor:'#fff',pointBorderWidth:1.5,pointHoverRadius:9};
 });
 const lines=(!cumulative?[
  {key:'mean',label:`Mean · ${fmt(limits.cl)}`,value:limits.cl,color:'#18876c'},
  {key:'limits',label:`Upper · ${fmt(limits.upper)}`,value:limits.upper,color:'#cf525b'},
  {key:'limits',label:`Lower · ${fmt(limits.lower)}`,value:limits.lower,color:'#cf525b'},
  {key:'target',label:`Target · ${fmt(config.target)}`,value:config.target,color:'#c18718'},
 ]:[]).filter(l=>l.value!==null&&show.includes(l.key)).map(l=>({label:l.label,data:labels.map(()=>l.value),borderColor:l.color,backgroundColor:l.color,borderWidth:1.5,borderDash:[6,5],pointRadius:0,pointHoverRadius:0}));
 const options = {
  responsive: true, maintainAspectRatio: false, animation: false as const,
  interaction: {mode: 'nearest' as const, intersect: true},
  plugins: {
   legend: {position: 'bottom' as const, labels: {usePointStyle: true, padding: 18, font: {size: 11}}},
   tooltip: {callbacks: {
    label: (c: import('chart.js').TooltipItem<'line'>) => `${c.dataset.label}: ${fmt(Number(c.raw))} ${config.unit}`,
    afterBody: (items: import('chart.js').TooltipItem<'line'>[]) => {
     const c=items[0]; if(!c||c.datasetIndex>=groups.length)return [];
     const p=groups[c.datasetIndex][c.dataIndex];
     return cumulative ? ['Cumulative observed total; missing months remain gaps.'] :
      [`${MONTHS[p.month]} ${p.year}`, ...(p.flags.length?p.flags:['No rule triggered']), `Mean ${fmt(limits.cl)} · upper ${fmt(limits.upper)} · lower ${fmt(limits.lower)}`];
    }
   }}
  },
  scales: {
   x: {grid: {display: false}, ticks: {maxTicksLimit: compare?12:18}},
   y: {title: {display: true, text: config.unit}, grid: {color: '#eaf0f5'}}
  }
 };
 return <Line ref={chartRef} data={{labels,datasets:[...datasets,...lines]}} options={options}/>;
}
export function AnnualChart({points,config}:{points:Point[];config:IndicatorConfig}){
 const years=[...new Set(points.map(p=>p.year))];
 const s=years.map(y=>statistics(points.filter(p=>p.year===y&&p.value!==null).map(p=>p.value!)));
 const options = {
  responsive:true, maintainAspectRatio:false, animation:false as const,
  plugins:{legend:{display:false},tooltip:{callbacks:{label:(c:import('chart.js').TooltipItem<'bar'>)=>`${fmt(Number(c.raw))} ${config.unit}`}}},
  scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#eaf0f5'}}}
 };
 return <Bar data={{labels:years.map((y,i)=>`${y} · ${s[i].n} months`),datasets:[{label:config.rollup==='sum'?'Observed total':'Monthly average',data:s.map(v=>v.n?(config.rollup==='sum'?v.sum:v.mean):null),backgroundColor:COLORS,borderRadius:6,maxBarThickness:65}]}} options={options}/>;
}
