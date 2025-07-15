// validators/orderValidator.js

const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Validation chain for creating an order.
 */
const validateOrder = [
  body('customerId')
    .exists().withMessage('customerId is required')
    .bail()
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
      .withMessage('customerId must be a valid Mongo ID'),

  body('shipToAddress')
    .exists().withMessage('shipToAddress is required')
    .bail()
    .isString().withMessage('shipToAddress must be a string')
    .notEmpty().withMessage('shipToAddress cannot be empty'),

  body('items')
    .exists().withMessage('items is required')
    .bail()
    .isArray({ min: 1 }).withMessage('items must be an array with at least one element'),

  body('items.*.productName')
    .exists().withMessage('Each item needs a productName')
    .bail()
    .isString().withMessage('productName must be a string')
    .notEmpty().withMessage('productName cannot be empty'),

  body('items.*.quantity')
    .exists().withMessage('Each item needs a quantity')
    .bail()
    .isInt({ gt: 0 }).withMessage('quantity must be an integer > 0'),

  body('items.*.rate')
    .exists().withMessage('Each item needs a rate')
    .bail()
    .isFloat({ gt: 0 }).withMessage('rate must be a number > 0'),

  body('deliveryDate')
    .exists().withMessage('deliveryDate is required')
    .bail()
    .isISO8601().withMessage('deliveryDate must be ISO 8601')
    .toDate(),

  body('deliveryTimeSlot')
    .exists().withMessage('deliveryTimeSlot is required')
    .bail()
    .isIn(['Morning','Afternoon','Evening'])
      .withMessage('deliveryTimeSlot must be one of: Morning, Afternoon, Evening'),

  // catch-all error handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = validateOrder;
