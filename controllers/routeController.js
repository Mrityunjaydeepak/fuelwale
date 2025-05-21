const express = require('express');
const router = express.Router();
const Model = require('../models/Route');

// GET all
router.get('/', async (req, res, next) => {
  try {
    const list = await Model.find();
    res.json(list);
  } catch (err) { next(err); }
});

// GET by id
router.get('/:id', async (req, res, next) => {
  try {
    const item = await Model.findById(req.params.id);
    res.json(item);
  } catch (err) { next(err); }
});

// CREATE
router.post('/', async (req, res, next) => {
  try {
    const newItem = await Model.create(req.body);
    res.status(201).json(newItem);
  } catch (err) { next(err); }
});

// UPDATE
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await Model.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
