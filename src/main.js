import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const BASE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MODEL='gpt-5-mini-2025-08-07';
const MAX_OUTPUT=2500;
const writeJson=(target,value)=>fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n','utf8');
const readJson=target=>JSON.parse(fs.readFileSync(target,'utf8'));

export function getData(scenario) {
  if (!['01','02','03'].includes(scenario)) throw new Error('Escenario no autorizado');
  const source=`datos/escenario_${scenario}.csv`;
  // Contrato de este archivo de demostración: CSV simple, sin comas embebidas.
  const lines=fs.readFileSync(path.join(BASE,source),'utf8').trim().split(/\r?\n/);
  const keys=lines.shift().split(',');
  const rows=lines.map(line=>Object.fromEntries(line.split(',').map((value,i)=>[keys[i],value])));
  const proposals=rows.map(row=>{
    const required=['stock','daily_demand','lead_days','safety_days','incoming','pack'];
    if(required.some(k=>row[k]===undefined || row[k]===''))
      return {sku:row.sku,quantity:null,action:'manual_review',detail:'Faltan datos; no se supone un valor'};
    const [stock,demand,lead,safety,incoming,pack]=required.map(k=>Number(row[k]));
    if (![stock,demand,lead,safety,incoming,pack].every(Number.isInteger) || Math.min(stock,demand,lead,safety,incoming)<0 || pack<=0)
      throw new Error('Dato numérico fuera de rango');
    const target=demand*(lead+safety);
    const needed=Math.max(0,target-stock-incoming);
    const quantity=Math.ceil(needed/pack)*pack;
    return {sku:row.sku,quantity,action:quantity?'buy':'no_order',
      detail:`Objetivo ${target}; stock ${stock}; entrante ${incoming}; múltiplo ${pack}`};
  });
  return {scenario,source,raw_rows:rows,proposals,
    formula:'ceil(max(0, demanda_diaria*(plazo+seguridad)-stock-entrante)/bulto)*bulto'};
}

async function callApi(payload) {
  const raw=JSON.stringify(payload);
  const ledgerPath=process.env.UCEMA_BUDGET_LEDGER||'.budget-ledger.json';
  const limit=Math.min(Number(process.env.UCEMA_BUDGET_USD||'1'),1);
  const ledger=fs.existsSync(ledgerPath)?readJson(ledgerPath):{reserved_usd:0,calls:[]};
  const reservation=(Buffer.byteLength(raw,'utf8')+4096)*0.25/1e6+MAX_OUTPUT*2/1e6;
  if(ledger.reserved_usd+reservation>limit) throw new Error('Se alcanzó el presupuesto de preparación');
  ledger.reserved_usd+=reservation;
  ledger.calls.push({reserved_usd:reservation,status:'reserved'});
  writeJson(ledgerPath,ledger);
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no está configurada');
  const start=performance.now();
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
    body:raw,signal:AbortSignal.timeout(90000)});
  if(!response.ok) throw new Error('La API devolvió HTTP '+response.status);
  const result=await response.json();
  const usage=result.usage||{};const cached=usage.input_tokens_details?.cached_tokens||0;
  const cost=((usage.input_tokens||0)-cached)*0.25/1e6+cached*0.025/1e6+(usage.output_tokens||0)*2/1e6;
  Object.assign(ledger.calls.at(-1),{status:result.status,estimated_actual_usd:cost,input_tokens:usage.input_tokens||0,output_tokens:usage.output_tokens||0});
  writeJson(ledgerPath,ledger);
  return {result,cost,seconds:(performance.now()-start)/1000};
}

async function main() {
  if(process.argv[2]==='--tool-only') {console.log(JSON.stringify(getData(process.argv[3]),null,2));return;}
  if(process.argv.length!==4) throw new Error('Uso: node src/main.js entradas/solicitud_01.json corridas/nueva_corrida');
  const entry=readJson(process.argv[2]); const out=path.resolve(process.argv[3]);
  if(fs.existsSync(out)) throw new Error('La carpeta de salida ya existe; usar otra');
  fs.mkdirSync(out,{recursive:true});writeJson(path.join(out,'entrada.json'),entry);
  const timestamp=new Date().toISOString();fs.writeFileSync(path.join(out,'fecha.txt'),timestamp+'\n');
  const instructions=fs.readFileSync(path.join(BASE,'prompts/system_prompt.md'),'utf8');
  const userTemplate=fs.readFileSync(path.join(BASE,'prompts/user_prompt.md'),'utf8');
  const tool=readJson(path.join(BASE,'config/tool.json'));
  const schema=readJson(path.join(BASE,'config/output_schema.json'));
  const common={model:MODEL,instructions,store:false,reasoning:{effort:'minimal'},max_output_tokens:MAX_OUTPUT};
  let conversation=[{role:'user',content:userTemplate+'\n\n'+JSON.stringify(entry)}];
  const requests=[],responses=[],costs=[],durations=[];let status='failed';
  try {
    const firstRequest={...common,input:conversation,tools:[tool],tool_choice:{type:'function',name:tool.name},parallel_tool_calls:false};
    requests.push(firstRequest);
    const first=await callApi(firstRequest);responses.push(first.result);costs.push(first.cost);durations.push(first.seconds);
    writeJson(path.join(out,'respuesta_api_01.json'),first.result);
    if(first.result.status!=='completed') throw new Error('Primera respuesta incompleta');
    const calls=first.result.output.filter(item=>item.type==='function_call');
    if(calls.length!==1||calls[0].name!==tool.name) throw new Error('Invocación de herramienta incorrecta');
    const args=JSON.parse(calls[0].arguments);
    if(args.scenario!==entry.scenario) throw new Error('Escenario incorrecto');
    const observation=getData(args.scenario);
    writeJson(path.join(out,'herramientas.json'),[{name:tool.name,arguments:args,observation}]);
    conversation=[...conversation,...first.result.output,{type:'function_call_output',call_id:calls[0].call_id,output:JSON.stringify(observation)}];
    const secondRequest={...common,input:conversation,text:{format:{type:'json_schema',name:'inventory',schema,strict:true}}};
    requests.push(secondRequest);
    const second=await callApi(secondRequest);responses.push(second.result);costs.push(second.cost);durations.push(second.seconds);
    writeJson(path.join(out,'respuesta_api_02.json'),second.result);
    if(second.result.status!=='completed') throw new Error('Respuesta final incompleta');
    const text=second.result.output.filter(i=>i.type==='message').flatMap(i=>i.content).filter(p=>p.type==='output_text').map(p=>p.text).join('');
    fs.writeFileSync(path.join(out,'salida_original.txt'),text,'utf8');
    const output=JSON.parse(text);writeJson(path.join(out,'salida.json'),output);
    const normalize=items=>items.map(p=>[p.sku,p.quantity,p.action]).sort((a,b)=>a[0].localeCompare(b[0]));
    const problems=[];
    if(JSON.stringify(normalize(output.proposals))!==JSON.stringify(normalize(observation.proposals))) problems.push('La propuesta no coincide con la herramienta');
    if(output.scenario!==observation.scenario) problems.push('Escenario incorrecto');
    if(output.requires_human_approval!==true) problems.push('Falta aprobación humana');
    writeJson(path.join(out,'validacion.json'),{ok:!problems.length,problems});
    status=problems.length?'needs_review':'validated';
  } catch(error) {
    writeJson(path.join(out,'error.json'),{type:error.name,message:error.message});
  } finally {
    writeJson(path.join(out,'solicitudes_api.json'),requests);
    const fingerprints={};
    const walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
      const p=path.join(dir,item.name);if(item.isDirectory())walk(p);
      else fingerprints[path.relative(BASE,p).split(path.sep).join('/')]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }};
    for(const dir of ['src','prompts','datos'])walk(path.join(BASE,dir));
    writeJson(path.join(out,'metadata.json'),{timestamp_utc:timestamp,requested_model:MODEL,returned_models:responses.map(r=>r.model),
      api_calls:responses.length,input_tokens:responses.reduce((n,r)=>n+(r.usage?.input_tokens||0),0),output_tokens:responses.reduce((n,r)=>n+(r.usage?.output_tokens||0),0),
      cost_usd:costs.reduce((a,b)=>a+b,0),latency_seconds:durations.reduce((a,b)=>a+b,0),status,source_sha256:fingerprints,
      pricing:{input_per_million_usd:0.25,cached_input_per_million_usd:0.025,output_per_million_usd:2,
      source:'https://developers.openai.com/api/docs/models/gpt-5-mini',checked_date:'2026-09-09'}});
  }
  console.log(JSON.stringify({status,run:out,cost_usd:costs.reduce((a,b)=>a+b,0)}));
  if(status!=='validated')process.exitCode=2;
}
main().catch(error=>{console.error(error.message);process.exitCode=2;});
