import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, Paper, Grid, CircularProgress, Chip, IconButton, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';

const VisuallyHiddenInput = styled('input')(`
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  bottom: 0;
  left: 0;
  white-space: nowrap;
  width: 1px;
`);

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
}));

const DocumentItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: '8px',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
  },
}));

const ProgressWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '8px',
  backgroundColor: theme.palette.grey[200],
  borderRadius: '4px',
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

const ProgressBar = styled(Box)(({ width, theme }) => ({
  position: 'absolute',
  height: '100%',
  width: `${width}%`,
  backgroundColor: theme.palette.primary.main,
  borderRadius: '4px',
  transition: 'width 0.3s ease',
}));

const AdminChatbotContent = () => {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [directInput, setDirectInput] = useState('');
  const [directTitle, setDirectTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categories = [
    { id: 'general', name: 'General Information' },
    { id: 'academics', name: 'Academic Programs' },
    { id: 'facilities', name: 'Campus Facilities' },
    { id: 'faculty', name: 'Faculty Information' },
    { id: 'events', name: 'Events & Activities' },
    { id: 'policies', name: 'Policies & Procedures' },
  ];

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/chatbot/documents');
      setDocuments(response.data.documents);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('documents', files[i]);
    }
    formData.append('category', selectedCategory);

    try {
      await axios.post('/api/admin/chatbot/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      fetchDocuments();
      setError(null);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDirectInputSubmit = async () => {
    if (!directInput.trim() || !directTitle.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress for better UX
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await axios.post('/api/admin/chatbot/documents/text', {
        title: directTitle,
        content: directInput,
        category: selectedCategory,
      });

      clearInterval(interval);
      setUploadProgress(100);
      
      // Reset form
      setDirectInput('');
      setDirectTitle('');
      
      // Refresh document list
      fetchDocuments();
      setError(null);
    } catch (err) {
      console.error('Text submission failed:', err);
      setError('Failed to submit text content. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await axios.delete(`/api/admin/chatbot/documents/${documentId}`);
      fetchDocuments();
      setError(null);
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete document. Please try again.');
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find((cat) => cat.id === categoryId);
    return category ? category.name : categoryId;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Chatbot Knowledge Base Management
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Add university-specific content to train the chatbot. Upload documents or directly input text.
      </Typography>

      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#fdeded', borderRadius: 1 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <StyledPaper>
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
              disabled={isUploading}
              fullWidth
            >
              {isUploading ? 'Uploading...' : 'Select Files'}
              <VisuallyHiddenInput
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
              />
            </Button>

            {isUploading && (
              <ProgressWrapper>
                <ProgressBar width={uploadProgress} />
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <Typography variant="body2">{uploadProgress}%</Typography>
                </Box>
              </ProgressWrapper>
            )}
          </StyledPaper>
        </Grid>

        <Grid item xs={12} md={6}>
          <StyledPaper>
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
              disabled={isUploading || !directInput.trim() || !directTitle.trim()}
              fullWidth
            >
              Submit Content
            </Button>
          </StyledPaper>
        </Grid>
      </Grid>

      <StyledPaper>
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
              <DocumentItem key={doc._id}>
                <Box>
                  <Typography variant="subtitle1">{doc.title || doc.filename}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip
                      label={getCategoryName(doc.category)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      label={doc.type || 'Text'}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={new Date(doc.createdAt).toLocaleDateString()}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                <Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteDocument(doc._id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </DocumentItem>
            ))}
          </Box>
        )}
      </StyledPaper>
    </Box>
  );
};

export default AdminChatbotContent;