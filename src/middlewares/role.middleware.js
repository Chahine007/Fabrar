export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Accesso negato: privilegi insufficienti",
      });
    }

    next();
  };
}
