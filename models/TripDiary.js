const { Schema, model } = require('mongoose');
const TripDiarySchema = new Schema({
  trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  odometerStart: Number,
  totalizerStart: Number,
  odometerEnd: Number,
  totalizerEnd: Number,
  loggedInAt: Date,
  loggedOutAt: Date
}, { timestamps: true });
module.exports = model('TripDiary', TripDiarySchema);
