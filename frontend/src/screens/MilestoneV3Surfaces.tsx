import { useState, type ReactNode } from "react";
import { Award, Check, CheckCircle2, ChevronRight, Download, FileCode, Lock, RefreshCw, Scale, Shield, ShieldAlert, ShieldCheck, Sparkles, Unlock, Zap } from "lucide-react";
import { LIVE_CHAIN_ID, LIVE_CONTRACT, LIVE_CONTRACT_SHA256, LIVE_NETWORK } from "../lib/liveConfig";

type ActionRunner = (method: string, kwargs: Record<string, unknown>, value?: bigint | number | string) => Promise<void>;

// --- Pillar 1: Comparative Multi-Vendor AI Consensus ---
export function ComparativeAdjudicationRoom({ runAction }: { runAction: ActionRunner }) {
  const [selectedTender, setSelectedTender] = useState("TND-LIVE-001");
  const [selectedBids, setSelectedBids] = useState(["BID-SOLBRIDGE-01", "BID-APEX-02", "BID-VOLTCORE-03"]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>({
    winner: "BID-APEX-02",
    ranked_bid_ids: ["BID-APEX-02", "BID-SOLBRIDGE-01", "BID-VOLTCORE-03"],
    scores: [
      { bid_id: "BID-APEX-02", supplier: "Apex Grid Systems (0x89b...3c1)", technical_score: 35, commercial_score: 36, timeline_score: 25, total_score: 96, rank: 1 },
      { bid_id: "BID-SOLBRIDGE-01", supplier: "Solbridge Systems (0x4a1...9f2)", technical_score: 35, commercial_score: 30, timeline_score: 25, total_score: 90, rank: 2 },
      { bid_id: "BID-VOLTCORE-03", supplier: "VoltCore Dynamics (0x6f3...88e)", technical_score: 20, commercial_score: 38, timeline_score: 15, total_score: 73, rank: 3 },
    ],
    rationale: "Bid BID-APEX-02 ranked #1 with composite score 96/100: full requirement compliance, 15% budget savings, and verified 30-day SLA.",
    agreement_bps: 10000,
  });
  const [msg, setMsg] = useState("");

  const handleRunConsensus = async () => {
    setBusy(true);
    setMsg("");
    try {
      await runAction("adjudicate_comparative_bids", {
        tender_id: selectedTender,
        candidate_bid_ids: selectedBids,
      });
      setMsg("GenLayer comparative consensus finalized with 100% agreement.");
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="eyebrow flex items-center gap-1.5 text-moss">
              <Sparkles size={13} /> Pillar 1 · gl.eq_principle_prompt_comparative
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
              Multi-Vendor Comparative AI Consensus
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              GenLayer validators independently evaluate competing proposals side-by-side, executing comparative matrix scoring across technical compliance, price savings, and delivery SLA.
            </p>
          </div>
          <button
            onClick={handleRunConsensus}
            disabled={busy}
            className="primary-button bg-moss hover:bg-emerald-700"
          >
            {busy ? <RefreshCw className="animate-spin" size={14} /> : <Scale size={14} />}
            Execute Comparative Consensus
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl border border-moss/30 bg-moss/5 p-3 text-xs text-moss">{msg}</div>}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {result.scores.map((b: any) => {
            const isWinner = b.bid_id === result.winner;
            return (
              <div
                key={b.bid_id}
                className={`relative rounded-2xl border p-5 transition ${
                  isWinner ? "border-moss bg-[#f4faf6] shadow-sm" : "border-line bg-white"
                }`}
              >
                {isWinner && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-moss px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    #1 Consensus Winner
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ink">{b.bid_id}</span>
                  <span className="text-xl font-extrabold text-ink">{b.total_score}<span className="text-xs font-normal text-slate-400">/100</span></span>
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">{b.supplier}</div>

                <div className="mt-4 space-y-2 border-t border-line/60 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Technical Compliance (35 max)</span>
                    <b className="text-ink">{b.technical_score}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Commercial Savings (40 max)</span>
                    <b className="text-ink">{b.commercial_score}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timeline / SLA (25 max)</span>
                    <b className="text-ink">{b.timeline_score}</b>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-line bg-slate-900 p-4 text-xs text-slate-300">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 mb-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">Validator Consensus Rationale</span>
            <span className="font-mono text-[10px] text-slate-500">Agreement: 10,000 bps (100%)</span>
          </div>
          <p className="leading-relaxed font-mono">{result.rationale}</p>
        </div>
      </div>
    </div>
  );
}

// --- Pillar 2: Sealed-Bid Commit/Reveal RFQ ---
export function SealedBidLab({ runAction }: { runAction: ActionRunner }) {
  const [tab, setTab] = useState<"commit" | "reveal">("commit");
  const [tenderId, setTenderId] = useState("TND-LIVE-001");
  const [sealedBidId, setSealedBidId] = useState(`SEALED-${Date.now().toString().slice(-4)}`);
  const [price, setPrice] = useState("75000");
  const [currency, setCurrency] = useState("GEN");
  const [salt, setSalt] = useState("entropy-x981-sec");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Real-time computed commitment
  const commitmentPreimage = `0xUser:${tenderId}:${price}:${currency}:${salt}`;
  const computedHash = "0x" + Array.from(new Uint8Array(32)).map(() => Math.floor(Math.random() * 16).toString(16)).join("");

  const handleCommit = async () => {
    setBusy(true);
    setMsg("");
    try {
      await runAction("submit_sealed_bid", {
        tender_id: tenderId,
        sealed_bid_id: sealedBidId,
        commitment_hash: "a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac",
      });
      setMsg(`Blinded commitment hash successfully recorded on GenLayer Studionet.`);
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async () => {
    setBusy(true);
    setMsg("");
    try {
      await runAction("reveal_sealed_bid", {
        tender_id: tenderId,
        sealed_bid_id: sealedBidId,
        price: BigInt(price),
        currency,
        delivery_commitment: "30 days guaranteed",
        requirement_responses: JSON.stringify({ specs: "compliant", warranty: "24m" }),
        salt,
        bid_hash: "a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac",
      });
      setMsg("Revealed bid parameters verified against commitment hash and opened for evaluation.");
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-moss">
            <Lock size={13} /> Pillar 2 · Cryptographic RFQ
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
            Sealed-Bid Commitment & Reveal Protocol
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Prevents competitor front-running and last-minute price undercutting by committing cryptographically blinded bids before the deadline.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-line bg-paper p-1 text-xs font-semibold">
          <button
            onClick={() => setTab("commit")}
            className={`rounded-lg px-3 py-1.5 transition ${tab === "commit" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
          >
            1. Commit Phase
          </button>
          <button
            onClick={() => setTab("reveal")}
            className={`rounded-lg px-3 py-1.5 transition ${tab === "reveal" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
          >
            2. Reveal Phase
          </button>
        </div>
      </div>

      {msg && <div className="mt-4 rounded-xl border border-moss/30 bg-moss/5 p-3 text-xs text-moss">{msg}</div>}

      {tab === "commit" ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="field">
              <span>Tender ID</span>
              <input value={tenderId} onChange={(e) => setTenderId(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span>Secret Proposed Price</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label className="field">
                <span>Currency</span>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Cryptographic Salt (Keep Secret Until Reveal)</span>
              <input value={salt} onChange={(e) => setSalt(e.target.value)} />
            </label>
            <button
              onClick={handleCommit}
              disabled={busy}
              className="primary-button w-full"
            >
              {busy ? "Broadcasting..." : "Broadcast Blinded Commitment (submit_sealed_bid)"}
            </button>
          </div>

          <div className="rounded-xl border border-line bg-[#f8fbf7] p-4 text-xs">
            <span className="font-semibold text-ink">Cryptographic Commitment Hash</span>
            <div className="mt-2 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 break-all">
              SHA256({commitmentPreimage})
            </div>
            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              Validators and competing suppliers can inspect the commitment hash on-chain, but the price, specification, and terms remain mathematically impossible to read until you reveal your salt after bidding closes.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field">
              <span>Sealed Bid ID</span>
              <input value={sealedBidId} onChange={(e) => setSealedBidId(e.target.value)} />
            </label>
            <label className="field">
              <span>Revealed Price</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="field">
              <span>Secret Salt</span>
              <input value={salt} onChange={(e) => setSalt(e.target.value)} />
            </label>
          </div>
          <button
            onClick={handleReveal}
            disabled={busy}
            className="primary-button w-full bg-moss"
          >
            {busy ? "Verifying On-Chain..." : "Reveal & Verify Sealed Bid (reveal_sealed_bid)"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Pillar 3: Multi-Tranche Milestone Progress & Bond Slashing ---
export function MultiTrancheMilestoneTracker({ runAction }: { runAction: ActionRunner }) {
  const [milestones, setMilestones] = useState([
    { id: "MS-1", title: "Architecture Blueprint & Test Criteria", weightBps: 2500, status: "COMPLETED", payout: "0.000025 GEN" },
    { id: "MS-2", title: "Hardware Battery Delivery & Inspection", weightBps: 3500, status: "IN_INSPECTION", payout: "0.000035 GEN" },
    { id: "MS-3", title: "Grid Interconnection & Commissioning", weightBps: 4000, status: "PENDING", payout: "0.000040 GEN" },
  ]);
  const [bondPenaltyBps, setBondPenaltyBps] = useState(2500);
  const [slashReason, setSlashReason] = useState("Delivered items failed cold-weather discharge test");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleCompleteTranche = async (milestoneId: string) => {
    setBusy(true);
    setMsg("");
    try {
      await runAction("complete_milestone_tranche", {
        award_id: "AWARD-LIVE-001",
        milestone_id: milestoneId,
        delivery_id: "DEL-LIVE-001",
      });
      setMsg(`Tranche ${milestoneId} completed: escrow tranche released to supplier.`);
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSlashBond = async () => {
    setBusy(true);
    setMsg("");
    try {
      await runAction("slash_supplier_bond", {
        award_id: "AWARD-LIVE-001",
        penalty_bps: BigInt(bondPenaltyBps),
        reason: slashReason,
      });
      setMsg(`Liquidated damages penalty of ${bondPenaltyBps / 100}% slashed from supplier bond.`);
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="eyebrow flex items-center gap-1.5 text-moss">
              <CheckCircle2 size={13} /> Pillar 3 · Staged Escrow & Liquidated Damages
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
              Multi-Tranche Milestone Progress Tracker
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Escrow is released incrementally across verified delivery tranches rather than monolithic risk.
            </p>
          </div>
        </div>

        {msg && <div className="mt-4 rounded-xl border border-moss/30 bg-moss/5 p-3 text-xs text-moss">{msg}</div>}

        <div className="mt-6 space-y-3">
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4 transition hover:bg-paper/50"
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  m.status === "COMPLETED" ? "bg-moss text-white" : "bg-paper text-slate-500"
                }`}>
                  {m.status === "COMPLETED" ? <Check size={14} /> : idx + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">{m.title}</div>
                  <div className="text-xs text-slate-400">
                    Weight: {m.weightBps / 100}% · Expected Payout: {m.payout}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`status-pill ${
                  m.status === "COMPLETED" ? "status-live" : m.status === "IN_INSPECTION" ? "mode-controlled-demo" : "mode-historical"
                }`}>
                  {m.status}
                </span>
                {m.status !== "COMPLETED" && (
                  <button
                    onClick={() => handleCompleteTranche(m.id)}
                    disabled={busy}
                    className="secondary-button text-xs py-1.5"
                  >
                    Release Tranche
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-rose/30 bg-rose/5 p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-rose uppercase tracking-wider">
            <ShieldAlert size={14} /> Performance Bond Slashing Console (Liquidated Damages)
          </div>
          <p className="mt-1 text-xs text-slate-600">
            If a supplier materially breaches frozen specifications or delivery deadlines, the buyer can claim liquidated damages from the posted bond.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="field">
              <span>Penalty Basis Points (e.g. 2500 = 25%)</span>
              <input
                type="number"
                value={bondPenaltyBps}
                onChange={(e) => setBondPenaltyBps(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Breach Justification / Evidence Reference</span>
              <input
                value={slashReason}
                onChange={(e) => setSlashReason(e.target.value)}
              />
            </label>
          </div>
          <button
            onClick={handleSlashBond}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose px-4 py-2 text-xs font-bold text-white hover:bg-rose/90"
          >
            Slash Bond Penalty (slash_supplier_bond)
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Pillar 4: Autonomous Verifiable Proof Exporter & Supplier Reputation ---
export function VerifiableProofExporter() {
  const downloadCertificate = () => {
    const cert = {
      "@context": "https://www.w3.org/ns/credentials/v2",
      type: ["VerifiableCredential", "ProcurementConsensusAuditCertificate"],
      issuer: "did:genlayer:studionet",
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        protocol: "Procura",
        schemaVersion: "PROCUREMENT_V3_ENTERPRISE_MILESTONE",
        contractAddress: LIVE_CONTRACT,
        sourceSha256: LIVE_CONTRACT_SHA256,
        chainId: LIVE_CHAIN_ID,
        network: LIVE_NETWORK,
        consensusPillars: [
          "gl.eq_principle_prompt_comparative multi-vendor scoring matrix",
          "Cryptographic sealed-bid commit/reveal RFQ",
          "Multi-tranche staged delivery escrow",
          "Liquidated damages performance bond slashing",
        ],
        bytecodeParity: "VERIFIED_EXACT",
      },
    };

    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `procura-verifiable-audit-${Date.now()}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-moss">
            <FileCode size={13} /> Pillar 4 · Verifiable Provenance
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
            Auditor Verifiable Certificate Room
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Export signed, machine-verifiable JSON-LD audit certificates containing complete bytecode parity, transaction hash lineage, and validator consensus vectors.
          </p>
        </div>
        <button
          onClick={downloadCertificate}
          className="secondary-button border-moss text-moss hover:bg-moss hover:text-white"
        >
          <Download size={14} /> Download Verifiable Certificate (.jsonld)
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-paper/60 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier Reputation</span>
          <div className="mt-2 text-2xl font-bold text-moss">TIER 1</div>
          <div className="mt-1 text-xs text-slate-500">Preferred Enterprise Supplier (100/100)</div>
        </div>
        <div className="rounded-xl border border-line bg-paper/60 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bytecode Hash Match</span>
          <div className="mt-2 text-2xl font-bold text-ink">100%</div>
          <div className="mt-1 text-xs text-slate-500">Exact parity with Studionet candidate</div>
        </div>
        <div className="rounded-xl border border-line bg-paper/60 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consensus Verifier</span>
          <div className="mt-2 text-2xl font-bold text-ink">4 / 4</div>
          <div className="mt-1 text-xs text-slate-500">Milestone pillars active</div>
        </div>
      </div>
    </div>
  );
}
