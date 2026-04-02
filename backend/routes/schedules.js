const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const authMiddleware = require('../middleware/auth');

// Get all schedules for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const schedules = await Schedule.find({ createdBy: req.userId }).sort({ createdAt: -1 });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create new schedule
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, channelId, channelName, message, interval, customInterval, specificTime } = req.body;
    
    const schedule = new Schedule({
      name,
      channelId,
      channelName,
      message,
      interval,
      customInterval,
      specificTime,
      createdBy: req.userId
    });
    
    await schedule.save();
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    Object.assign(schedule, req.body);
    await schedule.save();
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const schedule = await Schedule.findOneAndDelete({ _id: req.params.id, createdBy: req.userId });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Toggle schedule active status
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    schedule.isActive = !schedule.isActive;
    await schedule.save();
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

module.exports = router;