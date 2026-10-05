export type Mode = "LIVE" | "CONTROLLED DEMO" | "HISTORICAL";
export type CellStatus = "PASS" | "FAIL" | "REVIEW" | "EQUIVALENT" | "MISSING";

export type Requirement = {
  id: string;
  title: string;
  detail: string;
  type: "OBJECTIVE" | "SEMANTIC" | "CERTIFICATION" | "COMMERCIAL" | "DELIVERY";
  mandatory: boolean;
};

export type Supplier = { id: string; name: string; shortName: string; invited: boolean };

export type EvaluationCell = {
  status: CellStatus;
  note: string;
  evidence: string;
  objectiveFinding: string;
  semanticResult: string;
  provenance: string;
};

export type EvaluationRow = { requirement: Requirement; cells: Record<string, EvaluationCell> };

export type DemoData = {
  mode: Mode;
  scenario: { title: string; quantity: number; category: string; deliveryVerdict: string };
  tender: { id: string; title: string; deadline: string; buyer: string; funded: number; currency: string };
  suppliers: Supplier[];
  requirements: Requirement[];
  evaluationRows: EvaluationRow[];
  inspection: {
    awarded: Record<string, string>;
    delivered: Record<string, string>;
    mismatches: string[];
    verdict: string;
    evidence: string;
  };
  accounting: Record<string, number>;
};
