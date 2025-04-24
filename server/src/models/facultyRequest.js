const mongoose = require('mongoose');

const FacultyRequestSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  department: { 
    type: String, 
    required: true 
  },
  sectionsTeaching: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one section must be specified'
    }
  },
  photoUrl: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  processedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('FacultyRequest', FacultyRequestSchema);