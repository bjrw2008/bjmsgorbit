const mongoose = require('mongoose');

const buttonSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true, 
    trim: true 
  },
  callbackData: { 
    type: String, 
    trim: true 
  },
  url: { 
    type: String, 
    trim: true 
  },
  type: { 
    type: String, 
    enum: ['inline', 'url'], 
    default: 'inline' 
  }
});

const scheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Schedule name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  channelId: {
    type: String,
    required: [true, 'Channel ID is required'],
    trim: true
  },
  channelName: {
    type: String,
    default: '',
    trim: true,
    maxlength: [100, 'Channel name cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [4000, 'Message cannot exceed 4000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'photo', 'video', 'poll'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    default: null,
    trim: true
  },
  caption: {
    type: String,
    default: null,
    trim: true,
    maxlength: [1024, 'Caption cannot exceed 1024 characters']
  },
  buttons: [buttonSchema],
  pollQuestion: {
    type: String,
    default: null,
    trim: true
  },
  pollOptions: [{
    type: String,
    trim: true
  }],
  interval: {
    type: String,
    enum: ['every_minute', 'every_2_hours', 'daily', 'weekly', 'custom'],
    required: true
  },
  customInterval: {
    type: Number,
    default: null,
    min: [1, 'Custom interval must be at least 1 minute'],
    max: [43200, 'Custom interval cannot exceed 43200 minutes (30 days)']
  },
  specificTime: {
    hour: { 
      type: Number, 
      default: null, 
      min: 0, 
      max: 23 
    },
    minute: { 
      type: Number, 
      default: null, 
      min: 0, 
      max: 59 
    },
    dayOfWeek: { 
      type: Number, 
      default: null, 
      min: 0, 
      max: 6 
    }
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return v > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  maxSends: {
    type: Number,
    default: null,
    min: [1, 'Max sends must be at least 1'],
    max: [10000, 'Max sends cannot exceed 10000']
  },
  sentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  nextRunTime: {
    type: Date,
    default: () => new Date()
  },
  lastSent: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
scheduleSchema.index({ nextRunTime: 1, isActive: 1 });
scheduleSchema.index({ channelId: 1, isActive: 1 });
scheduleSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for status
scheduleSchema.virtual('status').get(function() {
  if (!this.isActive) return 'paused';
  if (this.endDate && this.endDate < new Date()) return 'expired';
  if (this.maxSends && this.sentCount >= this.maxSends) return 'completed';
  return 'active';
});

// Virtual for next run human readable
scheduleSchema.virtual('nextRunHuman').get(function() {
  if (!this.nextRunTime) return 'Not scheduled';
  const now = new Date();
  const diff = this.nextRunTime - now;
  if (diff < 0) return 'Overdue';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day(s) from now`;
  if (hours > 0) return `${hours} hour(s) from now`;
  return `${minutes} minute(s) from now`;
});

// Calculate next run time before saving
scheduleSchema.pre('save', function(next) {
  if (!this.nextRunTime || this.isModified('interval') || this.isModified('customInterval') || this.isModified('specificTime')) {
    const now = new Date();
    let nextRun = new Date(now);
    
    switch (this.interval) {
      case 'every_minute':
        nextRun.setMinutes(nextRun.getMinutes() + 1);
        nextRun.setSeconds(0, 0);
        break;
      case 'every_2_hours':
        nextRun.setHours(nextRun.getHours() + 2);
        nextRun.setMinutes(0, 0, 0);
        break;
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        if (this.specificTime && this.specificTime.hour !== null) {
          nextRun.setHours(this.specificTime.hour, this.specificTime.minute || 0, 0, 0);
        }
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        if (this.specificTime && this.specificTime.hour !== null) {
          nextRun.setHours(this.specificTime.hour, this.specificTime.minute || 0, 0, 0);
        }
        break;
      case 'custom':
        if (this.customInterval) {
          // Custom interval in MINUTES - convert to milliseconds
          nextRun = new Date(now.getTime() + (this.customInterval * 60 * 1000));
        }
        break;
      default:
        nextRun.setMinutes(nextRun.getMinutes() + 1);
    }
    
    this.nextRunTime = nextRun;
  }
  next();
});

// Method to check if schedule should still run
scheduleSchema.methods.shouldRun = function() {
  if (!this.isActive) return false;
  if (this.endDate && this.endDate < new Date()) return false;
  if (this.maxSends && this.sentCount >= this.maxSends) return false;
  return true;
};

// Static method to get active schedules count for a user
scheduleSchema.statics.getUserStats = async function(userId) {
  const total = await this.countDocuments({ createdBy: userId });
  const active = await this.countDocuments({ createdBy: userId, isActive: true });
  const completed = await this.countDocuments({ 
    createdBy: userId, 
    isActive: false,
    $or: [
      { maxSends: { $exists: true, $ne: null }, $expr: { $gte: ["$sentCount", "$maxSends"] } }
    ]
  });
  const totalSent = await this.aggregate([
    { $match: { createdBy: mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$sentCount" } } }
  ]);
  
  return {
    total,
    active,
    completed,
    totalSent: totalSent[0]?.total || 0
  };
};

module.exports = mongoose.model('Schedule', scheduleSchema);