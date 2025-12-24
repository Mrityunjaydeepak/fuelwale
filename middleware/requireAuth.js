// middleware/requireAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');

function toLowerArr(arr) {
  return (Array.isArray(arr) ? arr : []).map(r => String(r).toLowerCase());
}

module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!scheme || scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * TOKEN TYPE A: User tokens (from controllers/userController.js)
     * payload: { id, userType, ... }
     */
    if (payload?.id) {
      const user = await User.findById(payload.id)
        .select('userId userType depotCd employee driver customer')
        .populate('employee', 'empCd accessLevel roles')
        .lean();

      if (!user) return res.status(401).json({ error: 'User not found' });

      const rolesLower = toLowerArr(user.employee?.roles);
      const accessLevel = user.employee?.accessLevel;

      const isAdmin =
        user.userType === 'A' ||
        accessLevel === 2 ||
        rolesLower.includes('admin') ||
        rolesLower.includes('superadmin');

      req.user = {
        principal: 'user',
        id: String(user._id),
        userId: user.userId,
        userType: user.userType,
        depotCd: user.depotCd,

        // optional links (if you need them later)
        employee: user.employee?._id,
        driver: user.driver,
        customer: user.customer,

        empCd: user.employee?.empCd,
        accessLevel,
        roles: user.employee?.roles || [],
        isAdmin
      };

      return next();
    }

    /**
     * TOKEN TYPE B: Employee tokens (from routes/auth.js)
     * payload: { userId: <employeeId>, ... }
     */
    if (payload?.userId) {
      const emp = await Employee.findById(payload.userId)
        .select('empCd depotCd accessLevel roles')
        .lean();

      if (!emp) return res.status(401).json({ error: 'Employee not found' });

      const rolesLower = toLowerArr(emp.roles);
      const accessLevel = emp.accessLevel;

      const isAdmin =
        accessLevel === 2 ||
        rolesLower.includes('admin') ||
        rolesLower.includes('superadmin');

      req.user = {
        principal: 'employee',
        id: String(emp._id),
        empCd: emp.empCd,
        depotCd: emp.depotCd,
        accessLevel,
        roles: emp.roles || [],
        userType: isAdmin ? 'A' : 'E',
        isAdmin
      };

      return next();
    }

    return res.status(401).json({ error: 'Invalid token payload' });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
