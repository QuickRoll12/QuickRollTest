import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, Paper, Grid, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from 'axios';

const AdminChatbotContent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [directInput, setDirectInput] = useState('');
  const [directTitle, setDirectTitle] = useState('');

  const categories = [
    { id: 'general', name: 'General Information' },
    { id: 'academics', name: 'Academic Programs' },
    { id: 'facilities', name: 'Campus Facilities' },
    { id: 'faculty', name: 'Faculty Information' },
    { id: 'events', name: 'Events & Activities' },
    { id: 'policies', name: 'Policies & Procedures' },
  ];

  useEffect(() => {
    // Simplified loading state for initial debugging
    setLoading(false);
  }, []);

  const handleDirectInputSubmit = () => {
    alert('This feature will be available soon!');
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Chatbot Knowledge Base Management
      </Typography>
      
      <Typography variant="body1" paragraph>
        Add university-specific content to train the chatbot. Upload documents or directly input text.
      </Typography>

      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#fdeded' }}>
          <Typography color="error">{error}</Typography>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Documents
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload PDF, DOCX, or TXT files containing university information.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Category
              </Typography>
              <TextField
                select
                fullWidth
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                SelectProps={{
                  native: true,
                }}
                variant="outlined"
                size="small"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </TextField>
            </Box>

            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUploadIcon />}
              fullWidth
            >
              Select Files
              <input
                type="file"
                hidden
                multiple
                accept=".pdf,.docx,.txt"
              />
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Direct Text Input
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Directly enter text content for the chatbot to learn from.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Category
              </Typography>
              <TextField
                select
                fullWidth
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                SelectProps={{
                  native: true,
                }}
                variant="outlined"
                size="small"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </TextField>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Title
              </Typography>
              <TextField
                fullWidth
                placeholder="Enter a descriptive title"
                value={directTitle}
                onChange={(e) => setDirectTitle(e.target.value)}
                variant="outlined"
                size="small"
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Content
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                placeholder="Enter information about the university..."
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                variant="outlined"
              />
            </Box>

            <Button
              variant="contained"
              onClick={handleDirectInputSubmit}
              fullWidth
            >
              Submit Content
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Uploaded Knowledge Base Content
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : documents.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No documents have been uploaded yet
            </Typography>
          </Box>
        ) : (
          <Box>
            {documents.map((doc) => (
              <Paper key={doc._id} sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle1">{doc.title || doc.filename}</Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AdminChatbotContent;