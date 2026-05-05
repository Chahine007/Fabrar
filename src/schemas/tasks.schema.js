import { z } from "zod";

export const TASK_STATUS_VALUES = ["TODO", "IN_PROGRESS", "DONE"];
export const TASK_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function normalizeTaskStatusInput(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized) {
    case "DA FARE":
    case "TODO":
      return "TODO";
    case "IN CORSO":
    case "IN PROGRESS":
    case "IN_PROGRESS":
    case "IN REVISIONE":
      return "IN_PROGRESS";
    case "COMPLETATO":
    case "DONE":
      return "DONE";
    default:
      return normalized;
  }
}

function normalizeTaskPriorityInput(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized) {
    case "BASSA":
    case "LOW":
      return "LOW";
    case "MEDIA":
    case "MEDIUM":
      return "MEDIUM";
    case "ALTA":
    case "HIGH":
      return "HIGH";
    case "CRITICA":
    case "CRITICAL":
      return "CRITICAL";
    default:
      return normalized;
  }
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .optional()
  .nullable();

const optionalPositiveInt = z.preprocess(
  (value) => (value == null || value === "" ? null : value),
  z.coerce.number().int().positive("ID non valido.").nullable().optional()
);

const optionalDueDate = z.preprocess(
  (value) => (value == null || value === "" ? null : value),
  z.coerce.date().nullable().optional()
);

const optionalTaskStatus = z.preprocess(
  (value) => (value == null || value === "" ? undefined : normalizeTaskStatusInput(value)),
  z.enum(TASK_STATUS_VALUES).optional()
);

const optionalTaskPriority = z.preprocess(
  (value) => (value == null || value === "" ? undefined : normalizeTaskPriorityInput(value)),
  z.enum(TASK_PRIORITY_VALUES).optional()
);

export const listTasksSchema = z.object({
  query: z.object({
    cantiere_id: optionalPositiveInt,
    assignee_id: optionalPositiveInt,
    status: optionalTaskStatus,
    priority: optionalTaskPriority,
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createTaskSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    cantiere_id: z.coerce.number().int().positive("ID cantiere non valido."),
    title: z.string().trim().min(1, "Il titolo del task è obbligatorio."),
    description: optionalText,
    status: optionalTaskStatus,
    priority: optionalTaskPriority,
    due_date: optionalDueDate,
    assignee_id: optionalPositiveInt,
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    taskId: z.coerce.number().int().positive("ID task non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      cantiere_id: optionalPositiveInt,
      title: z.string().trim().min(1, "Il titolo del task non puo essere vuoto.").optional(),
      description: optionalText,
      status: optionalTaskStatus,
      priority: optionalTaskPriority,
      due_date: optionalDueDate,
      assignee_id: optionalPositiveInt,
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteTaskSchema = z.object({
  params: z.object({
    taskId: z.coerce.number().int().positive("ID task non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});
