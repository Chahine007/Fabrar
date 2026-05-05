export async function ensureCantiereActive(prisma, cantiereId) {
  const cantiere = await prisma.cantiere.findFirst({
    where: { id: Number(cantiereId), attivo: 1 },
    select: { id: true },
  });

  return Boolean(cantiere);
}

export async function ensureTaskBelongsToCantiere(prisma, taskId, cantiereId) {
  if (taskId == null) return true;

  const task = await prisma.task.findUnique({
    where: { id: Number(taskId) },
    select: { id: true, cantiere_id: true },
  });

  return Boolean(task && task.cantiere_id === Number(cantiereId));
}

export async function ensureWbsBelongsToCantiere(prisma, wbsNodeId, cantiereId) {
  if (wbsNodeId == null) return true;

  const node = await prisma.wbsNode.findUnique({
    where: { id: Number(wbsNodeId) },
    select: { id: true, cantiere_id: true },
  });

  return Boolean(node && node.cantiere_id === Number(cantiereId));
}

export async function getRootWbsId(prisma, cantiereId) {
  const root = await prisma.wbsNode.findFirst({
    where: { cantiere_id: Number(cantiereId), parent_id: null },
    select: { id: true },
  });

  return root?.id ?? null;
}
