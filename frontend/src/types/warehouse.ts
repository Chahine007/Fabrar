export type NumericLike = number | string;

export interface WarehouseArticle {
  id: number;
  codice_sku: string;
  descrizione: string;
  unita_misura: string | null;
  costo_medio?: NumericLike | null;
  scorta_minima?: NumericLike | null;
  categoria?: string | null;
  fornitore_default_id?: number | null;
  fornitore_default?: {
    id: number;
    ragione_sociale: string;
  } | null;
}

export interface WarehouseLocation {
  id: number;
  codice: string;
  descrizione: string;
}

export interface WarehouseStockRow {
  id: number;
  articolo_id?: number;
  ubicazione_id?: number;
  quantita_disponibile: NumericLike;
  quantita_riservata: NumericLike;
  articolo: WarehouseArticle;
  ubicazione: WarehouseLocation;
}

export interface WarehouseTaskRef {
  id: number;
  title: string;
}

export interface WarehouseWbsRef {
  id: number;
  nome: string;
}

export interface WarehouseMovementRow {
  id: number;
  data_movimento: string;
  quantita: NumericLike;
  valore_totale: NumericLike;
  articolo: WarehouseArticle;
  ubicazione_da: WarehouseLocation | null;
  wbs_node: WarehouseWbsRef | null;
  task: WarehouseTaskRef | null;
}

export interface PricebookItem {
  id: number;
  nome: string;
  unita: string | null;
  costo_unitario: NumericLike;
}

export interface ProjectMaterialRow {
  id: number;
  timestamp_utc: string;
  quantita: NumericLike;
  importo: NumericLike;
  pricebook: PricebookItem | null;
  wbs_node: WarehouseWbsRef | null;
}

export interface WarehouseMovementCreatePayload {
  tipo_movimento: 'CARICO' | 'SCARICO_CANTIERE';
  articolo_id: number;
  quantita: number;
  ubicazione_da_id?: number;
  ubicazione_a_id?: number;
  cantiere_id?: number;
  wbs_node_id?: number | null;
  task_id?: number | null;
  costo_acquisto?: number;
  documento_id?: number | null;
  fornitore_id?: number | null;
}

export interface WarehouseArticleCreatePayload {
  codice_sku: string;
  descrizione: string;
  unita_misura: string;
  costo_medio?: number | null;
  scorta_minima?: number | null;
  categoria?: string | null;
  fornitore_default_id?: number | null;
}

export interface AddProjectMaterialPayload {
  pricebook_id: number;
  quantita: number;
  importo: number;
  wbs_node_id?: number | null;
}
