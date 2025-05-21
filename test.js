
/**
 * test.js
 * Simple test runner for API endpoints using Axios.
 * Ensure you have a .env file with BASE_URL set (e.g., BASE_URL=http://localhost:3000).
 * Install dependencies and run:
 *   npm install axios dotenv
 *   node test.js
 */
require('dotenv').config();
const axios = require('axios');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const entities = [
  {
    name: 'users',
    sample: { userId: 'user1', userType: 'A', pwd: 'pass123' }
  },
  {
    name: 'employees',
    sample: { empCd: 'E001', empName: 'Alice', depotCd: 'D001', accessLevel: 1 }
  },
  {
    name: 'depots',
    sample: {
      depotCd: 'D001',
      depotName: 'Main Depot',
      depotAdd1: '123 Main St',
      depotAdd2: '',
      depotAdd3: '',
      depotArea: 'Area 1',
      city: 'CityX',
      pin: 123456,
      stateCd: 'ST'
    }
  },
  {
    name: 'customers',
    sample: {
      depotCd: 'D001',
      custName: 'Customer1',
      custCd: 'C001',
      empCdMapped: 'E001',
      routeCdMapped: 'R001',
      billToAdd1: '456 Elm St',
      billToAdd2: '',
      billToAdd3: '',
      area: 'Area2',
      city: 'CityY',
      pin: 654321,
      stateCd: 'ST'
    }
  },
  {
    name: 'loadings',
    sample: {
      vehicleNo: 'V001',
      depotCd: 'D001',
      loadingAuthorisationCd: 'AUTH1',
      loadingSource: 'LS1',
      driverCd: 'DR1',
      productCd: 'P001',
      loadedQty: 1000,
      date: new Date().toISOString(),
      time: '10:00'
    }
  },
  {
    name: 'loading-sources',
    sample: {
      loadSourceCd: 'LS1',
      name: 'Source1',
      add1: '789 Oak St',
      add2: '',
      add3: '',
      area: 'Area3',
      city: 'CityZ',
      pin: 111222,
      stateCd: 'ST'
    }
  },
  {
    name: 'vehicle-masters',
    sample: {
      vehicleNo: 'V001',
      depotCd: 'D001',
      brand: 'BrandX',
      model: 'ModelY',
      calibratedCapacity: 5000,
      dipStickYesNo: true,
      gpsYesNo: false,
      loadSensorYesNo: true,
      route: 'R001'
    }
  },
  {
    name: 'bowser-inventories',
    sample: {
      timeStamp: new Date().toISOString(),
      vehicleNo: 'V001',
      depotCd: 'D001',
      opBal: 500,
      trType: 'IN',
      trRef: 'REF1',
      trQty: 1000,
      clStock: 1500
    }
  },
  {
    name: 'payments',
    sample: {
      custCd: 'C001',
      paymentType: 'Cash',
      refNo: 'PAY1',
      amount: 5000,
      date: new Date().toISOString(),
      time: '12:00'
    }
  },
  {
    name: 'orders',
    sample: {
      salesOrderNo: 'SO001',
      custCd: 'C001',
      productCd: 'P001',
      orderQty: 2000,
      deliveryDate: new Date().toISOString(),
      deliveryTimeSlot: 'Morning'
    }
  }
];

(async () => {
  for (const entity of entities) {
    const path = `/api/${entity.name}`;
    console.log(`\n=== Testing ${entity.name.toUpperCase()} ===`);
    try {
      // CREATE
      console.log('POST', path, entity.sample);
      const createRes = await axios.post(baseUrl + path, entity.sample);
      console.log('Created:', createRes.data);
      const id = createRes.data._id || createRes.data.id;
      // READ ALL
      console.log('GET', path);
      const allRes = await axios.get(baseUrl + path);
      console.log('All:', allRes.data);
      // READ BY ID
      console.log('GET', `${path}/${id}`);
      const oneRes = await axios.get(`${baseUrl}${path}/${id}`);
      console.log('By ID:', oneRes.data);
      // UPDATE
      const updatedData = { ...entity.sample };
      const key = Object.keys(updatedData)[0];
      updatedData[key] = typeof updatedData[key] === 'string' ? updatedData[key] + '_updated' : updatedData[key];
      console.log('PUT', `${path}/${id}`, updatedData);
      const updateRes = await axios.put(`${baseUrl}${path}/${id}`, updatedData);
      console.log('Updated:', updateRes.data);
      // DELETE
      console.log('DELETE', `${path}/${id}`);
      const delRes = await axios.delete(`${baseUrl}${path}/${id}`);
      console.log('Deleted:', delRes.data);
    } catch (error) {
      console.error(`Error testing ${entity.name}:`, error.response ? error.response.data : error.message);
    }
  }
})();
