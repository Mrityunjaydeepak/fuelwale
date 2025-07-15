// server.js (or app.js)

// 1. Load .env into process.env before anything else
require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 2. Connect to MongoDB using MONGO_URI from .env
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// 3. Import your controllers / routers
const userRouter             = require('./controllers/userController');
const employeeRouter         = require('./controllers/employeeController');
const depotRouter            = require('./controllers/depotController');
const customerRouter         = require('./routes/customerRoutes');
const routeRouter            = require('./controllers/routeController');
const loadingRouter          = require('./controllers/loadingController');
const loadingSourceRouter    = require('./controllers/loadingsourceController');
const vehicleMasterRouter    = require('./controllers/vehiclemasterController');
const bowserInventoryRouter  = require('./controllers/bowserinventoryController');
const paymentReceivedRouter  = require('./controllers/paymentreceivedController');
const orderRouter            = require('./controllers/orderController');
const salesAssociateRouter   = require('./controllers/salesAssociateController');
const authRouter             = require('./routes/auth');
const driverRouter           = require('./controllers/driverController');
const tripRouter             = require('./controllers/tripController');
const deliveryRouter         = require('./controllers/deliveryController');
// ← Import the new Vehicle controller:
const vehicleRouter          = require('./controllers/vehicleController');
const stationController = require('./controllers/stationController');

// 4. Mount under /api
app.use('/api/auth',                authRouter);
app.use('/api/users',               userRouter);
app.use('/api/employees',           employeeRouter);
app.use('/api/depots',              depotRouter);
app.use('/api/customers',           customerRouter);
app.use('/api/routes',              routeRouter);
app.use('/api/loadings',            loadingRouter);
app.use('/api/loadingsources',      loadingSourceRouter);
app.use('/api/vehiclemasters',      vehicleMasterRouter);
app.use('/api/vehicles',            vehicleRouter);            // ← fixed mount
app.use('/api/bowserinventories',   bowserInventoryRouter);
app.use('/api/payments',            paymentReceivedRouter);
app.use('/api/orders',              orderRouter);
app.use('/api/sales-associates',    salesAssociateRouter);
app.use('/api/drivers',             driverRouter);
app.use('/api/trips',               tripRouter);
app.use('/api/deliveries',          deliveryRouter);
app.use('/api/stations', stationController);

// 5. Catch-all 404 for anything under /api
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.originalUrl}` });
});

// 6. Global error handler
app.use((err, req, res, next) => {
  console.error('🛑 Server Error:', err);
  res.status(err.status || 500).json({ error: err.message });
});

// 7. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
