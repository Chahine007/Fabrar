export interface WbsBurn {
  ore_tot: number;
  costo_manodopera: number;
  costo_materiali: number;
  totale: number;
}

export interface WbsNode {
  id: number;
  nome: string;
  budget_preventivato: number | null;
  parent_id: number | null;
  is_variant: boolean;
  burn: WbsBurn;
  avanzamento_pct: number | null;
  children: WbsNode[];
}

export interface WbsSelectOption {
  id: number;
  nome: string;
  label: string;
}

export interface WbsNodeUpdateFields {
  nome?: string;
  budget_preventivato?: number | null;
}
