// Live Studionet reviewer qualification for the five steward-required Procura V2.1.2 writes.
// Creates ephemeral testnet-only buyer and supplier accounts; never logs signing keys.
// Run from frontend after confirming correct Studionet chain and contract. No blind rebroadcast.
import fs from "node:fs";
import {createHash} from "node:crypto";
import {createAccount,createClient} from "genlayer-stable";
import {studionet} from "genlayer-stable/chains";

const contract="0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929";
const rpc="https://studio.genlayer.com/api";
if(studionet.id!==61999)throw Error("wrong chain preset");
const schema=JSON.parse(fs.readFileSync("../contracts/schema.json","utf8"));
if(schema.schemaVersion!=="PROCUREMENT_V2_1_2_EVIDENCE_STUDIONET")throw Error("wrong schema");
const buyer=createClient({chain:studionet,endpoint:rpc,account:createAccount()});
const supplier=createClient({chain:studionet,endpoint:rpc,account:createAccount()});
const base=createClient({chain:studionet,endpoint:rpc});
const sha=value=>createHash("sha256").update(value).digest("hex");
const canonical=x=>typeof x==="bigint"?JSON.stringify(x.toString()):Array.isArray(x)?"["+x.map(canonical).join(",")+"]":x!==null&&typeof x==="object"?"{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}":JSON.stringify(x);
const commitment=(method,kwargs,exclude)=>{const spec=schema.methods.find(m=>m.name===method);if(!spec)throw Error("schema method missing "+method);return sha(canonical({schemaVersion:schema.schemaVersion,method,arguments:spec.arguments.filter(name=>name!==exclude).map(name=>({name,value:kwargs[name]}))}));};
const iso=ms=>new Date(ms).toISOString();
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const proof={chainId:61999,contract,writes:[],qualification:"PENDING"};
const tender="PROCURA-V212-STEWARD-"+Date.now();
const bid=tender+"-BID",award=tender+"-AWARD",delivery=tender+"-DELIVERY";
proof.tenderId=tender;
console.log("QUALIFICATION_BEGIN",tender);

async function write(role,method,args,value=0n){
  const client=role==="buyer"?buyer:supplier;
  const call={address:contract,functionName:method,args,value};
  const hash=await client.writeContract(call);
  const record={method,hash,actor:role,status:"SUBMITTED"};
  proof.writes.push(record);
  console.log("SUBMITTED",method,hash);
  for(let i=0;i<55;i++){
    await delay(2000);
    const tx=await base.getTransaction({hash});
    if(tx.statusName==="FINALIZED"){
      record.status=tx.statusName;record.consensus=tx.result_name;
      const execution=tx.consensus_data?.leader_receipt?.[0]?.result?.status;
      record.execution=execution??"UNKNOWN";
      console.log("FINALIZED",method,hash,tx.result_name,execution);
      if(tx.result_name!=="MAJORITY_AGREE"||execution!=="return")throw Error(method+" did not finish with successful validator execution: "+hash);
      return hash;
    }
    if(["CANCELED","UNDETERMINED"].includes(tx.statusName))throw Error(method+" failed with status "+tx.statusName+": "+hash);
  }
  throw Error(method+" not finalized; reconcile exact hash "+hash);
}
async function tenderState(expected){
  const t=await base.readContract({address:contract,functionName:"get_tender",args:[tender]});
  if(t.state!==expected)throw Error("tender state "+t.state+" expected "+expected);
  console.log("READBACK_TENDER",expected);
  return t;
}
try{
  for(const [role,client] of [["buyer",buyer],["supplier",supplier]]){
    const amount=4000000000000000;
    await base.request({method:"sim_fundAccount",params:[client.account.address,amount]});
    const balance=await base.getBalance({address:client.account.address});
    if(balance<BigInt(amount))throw Error(role+" faucet funding missing");
    console.log("FUNDED_TEST_ACCOUNT",role,client.account.address,String(balance));
  }
  const now=Date.now();
  const create={
    tender_id:tender,title:"Reviewer LIVE schema and delivery verification",
    description:"Temporary procurement of a publicly verifiable GenLayer network specification",
    category:"DIGITAL_ARTIFACT",currency_label:"GEN",budget_ceiling:100000000000000n,
    bid_deadline:iso(now+10800000),evaluation_deadline:iso(now+14400000),
    delivery_deadline:iso(now+172800000),equivalence_policy:"STRICT_EVIDENCE",
    evaluation_policy:"FROZEN_OBJECTIVE",payment_policy:"FULL",supplier_bond_policy:"NONE"
  };
  create.tender_hash=commitment("create_tender",create,"tender_hash");
  await write("buyer","create_tender",schema.methods.find(m=>m.name==="create_tender").arguments.map(k=>create[k]));
  await tenderState("DRAFT");
  const requirement=tender+"-REQUIREMENT";
  await write("buyer","add_requirement",[
    tender,requirement,"Official document verification","Public manifest verifies the submitted artifact",
    "OBJECTIVE",true,"==","1","count",false,true,
    "Does the independently authenticated source support this specification?","HIGH"
  ]);
  await write("buyer","freeze_tender",[tender]);
  await tenderState("FROZEN");
  await write("buyer","fund_tender",[tender],100000000000000n);
  await tenderState("FUNDED");
  const url="https://cdn.jsdelivr.net/npm/genlayer-js@1.1.8/package.json";
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error("evidence origin unavailable");
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length===0||bytes.length>10000000)throw Error("evidence size invalid");
  const observed=iso(Date.now()),published=observed,contentSha=sha(bytes);
  const bidTime=iso(Date.now()+1000);
  await delay(1200);
  const bidArgs={bid_id:bid,tender_id:tender,price:100000000000000n,currency:"GEN",
    delivery_commitment:"Public content hash and package manifest",
    requirement_responses:JSON.stringify({[requirement]:"1"}),submitted_at:bidTime};
  bidArgs.bid_hash=commitment("submit_bid",bidArgs,"bid_hash");
  await write("supplier","submit_bid",schema.methods.find(m=>m.name==="submit_bid").arguments.map(k=>bidArgs[k]));
  await write("supplier","add_bid_evidence",[bid,bid+"-EVID","GenLayer official documentation",url,contentSha,BigInt(bytes.length),observed,published,"PUBLIC_SPECIFICATION"]);
  await write("buyer","begin_bid_evaluation",[tender]);
  await tenderState("EVALUATING");
  await write("buyer","adjudicate_requirement",[bid,requirement,contentSha]);
  await write("buyer","finalize_bid_evaluation",[tender]);
  await tenderState("EVALUATED");
  const deliveryDeadline=iso(Date.now()+86400000);
  await write("buyer","award_bid",[tender,award,bid,"Public network documentation manifest",String(bidArgs.price),deliveryDeadline,sha(award)]);
  await tenderState("AWARDED");
  await write("supplier","accept_award",[award]);
  const deliveryObserved=iso(Date.now());
  const deliveredAt=iso(Date.now()+1000);
  await delay(1200);
  await write("supplier","create_delivery",[delivery,award,url,"Official public network specification",1n,"DOC-GENLAYER-NETWORKS",deliveredAt]);
  await write("supplier","add_delivery_evidence",[delivery,delivery+"-EVID","GenLayer official documentation",url,contentSha,BigInt(bytes.length),deliveryObserved,deliveryObserved,"PUBLIC_SPECIFICATION"]);
  const item=await base.readContract({address:contract,functionName:"get_delivery",args:[delivery]});
  const evidence=await base.readContract({address:contract,functionName:"get_evidence",args:[delivery+"-EVID"]});
  if(!item||!evidence)throw Error("delivery canonical readback failed");
  proof.qualification="PASS";proof.deliveryId=delivery;proof.awardId=award;
  console.log("QUALIFICATION_PASS",JSON.stringify(proof));
}catch(e){proof.error=String(e);console.log("QUALIFICATION_INCOMPLETE",JSON.stringify(proof));process.exitCode=1}
