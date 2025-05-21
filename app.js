require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Mongo
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Import routers
const userRouter             = require('./controllers/userController');
const employeeRouter         = require('./controllers/employeeController');
const depotRouter            = require('./controllers/depotController');
const customerRouter         = require('./controllers/customerController');
const routeRouter            = require('./controllers/routeController');
const loadingRouter          = require('./controllers/loadingController');
const loadingSourceRouter    = require('./controllers/loadingsourceController');
const vehicleMasterRouter    = require('./controllers/vehiclemasterController');
const bowserInventoryRouter  = require('./controllers/bowserinventoryController');
const paymentReceivedRouter  = require('./controllers/paymentreceivedController');
const orderRouter            = require('./controllers/orderController');
const salesAssociateRouter   = require('./controllers/salesAssociateController'); 
const driverRouter = require('./controllers/driverController');
app.use('/api/drivers', driverRouter); // <— make sure this path is correct

// Mount them under /api
app.use('/api/users',              userRouter);
app.use('/api/employees',          employeeRouter);
app.use('/api/depots',             depotRouter);
app.use('/api/customers',          customerRouter);
app.use('/api/routes',             routeRouter);
app.use('/api/loadings',           loadingRouter);
app.use('/api/loadingsources',     loadingSourceRouter);
app.use('/api/vehiclemasters',     vehicleMasterRouter);
app.use('/api/bowserinventories',  bowserInventoryRouter);
app.use('/api/payments',           paymentReceivedRouter);
app.use('/api/orders',             orderRouter);
app.use('/api/sales-associates',   salesAssociateRouter);  // <— this line

// Fallback 404 for APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🛑 Server Error:', err);
  res.status(err.status || 500).json({ error: err.message });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
