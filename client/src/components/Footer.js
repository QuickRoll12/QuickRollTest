import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Container, Button, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledFooter = styled(Box)(({ theme }) => ({
  backgroundColor: '#1976d2',
  color: 'white',
  padding: theme.spacing(1, 0),
  position: 'fixed',
  bottom: 0,
  width: '100%',
  height: '60px',
  '@media (max-width: 600px)': {
    padding: theme.spacing(0.5, 0),
    height: '50px',
  }
}));

const FooterButton = styled(Button)({
  color: 'white',
  padding: '4px 8px',
  minWidth: 'auto',
  fontSize: '0.875rem',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '@media (max-width: 600px)': {
    fontSize: '0.75rem',
    padding: '2px 6px',
  }
});


const Footer = () => {
  const handleContactAdmin = (e) => {
    e.preventDefault();
    window.location.href = `mailto:${process.env.REACT_APP_ADMIN_EMAIL}?subject=Contact%20Request&body=Hello%20Admin,%0A%0A`;
  };

  const handleRaiseQuery = (e) => {
    e.preventDefault();
    window.location.href = `mailto:${process.env.REACT_APP_ADMIN_EMAIL}?subject=Query%20Request&body=Hello%20Admin,%0A%0AQuery%20Details:%0A`;
  };

  return (
    <StyledFooter>
      <Container maxWidth="lg">
        <Stack 
          direction="row" 
          spacing={2} 
          justifyContent="center" 
          alignItems="center"
          height="100%"
          sx={{ pb: 3 }}
        >
          <FooterButton component={Link} to="/">
            Home
          </FooterButton>
          <FooterButton component={Link} to="/about">
            About Us
          </FooterButton>
          <FooterButton onClick={handleContactAdmin}>
            Contact Us
          </FooterButton>
          <FooterButton onClick={handleRaiseQuery}>
            Raise Query
          </FooterButton>
          <FooterButton onClick={() => window.open("https://student.gehu.ac.in", "_blank")}>
  GEHU ERP
</FooterButton>
        </Stack>
      </Container>
    </StyledFooter>
  );
};

export default Footer;
