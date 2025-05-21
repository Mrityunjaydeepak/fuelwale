const mongoose = require('mongoose');

const Depot = require('./Depot');
const SalesAssociate = require('./SalesAssociate');
const Employee = require('./Employee');
const Customer = require('./Customer');
const Route = require('./Route');
const ShipToAddress = require('./ShipToAddress');
const Vehicle = require('./Vehicle');
const Driver = require('./Driver');
const LoadingStation = require('./LoadingStation');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Trip = require('./Trip');
const TripAssignment = require('./TripAssignment');
const TripDiary = require('./TripDiary');
const Invoice = require('./Invoice');

module.exports = {
  Depot,
  SalesAssociate,
  Employee,
  Customer,
  Route,
  ShipToAddress,
  Vehicle,
  Driver,
  LoadingStation,
  Order,
  OrderItem,
  Trip,
  TripAssignment,
  TripDiary,
  Invoice
};
