describe('RailQR AI authentication pages', () => {
  it('shows the complete sign-in form', () => {
    cy.visit('/login');

    cy.contains('h2', 'Welcome Back').should('be.visible');
    cy.contains('Sign in to access your dashboard').should('be.visible');
    cy.get('input[type="email"]').should('be.visible').and('have.attr', 'required');
    cy.get('input[type="password"]').should('be.visible').and('have.attr', 'required');
    cy.contains('button', 'Sign In').should('be.enabled');
  });

  it('keeps the user on sign in when required credentials are empty', () => {
    cy.visit('/login');

    cy.get('input[type="email"]').then(($email) => {
      expect(($email[0] as HTMLInputElement).validity.valueMissing).to.eq(true);
    });
    cy.get('input[type="password"]').then(($password) => {
      expect(($password[0] as HTMLInputElement).validity.valueMissing).to.eq(true);
    });
    cy.contains('button', 'Sign In').click();
    cy.location('pathname').should('eq', '/login');
  });

  it('rejects an email value without a valid email format', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('not-an-email');

    cy.get('input[type="email"]').then(($email) => {
      expect(($email[0] as HTMLInputElement).validity.typeMismatch).to.eq(true);
    });
  });

  it('accepts and retains typed email and password values', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('operator@example.com', { delay: 50 }).should('have.value', 'operator@example.com');
    cy.get('input[type="password"]').type('RailQR!123', { delay: 50 }).should('have.value', 'RailQR!123');
  });

  it('toggles the password field between hidden and visible text', () => {
    cy.visit('/login');
    cy.get('input[type="password"]').type('Secret123');
    cy.get('input[type="password"]').parent().find('button').click();

    cy.get('input[type="text"]').should('have.value', 'Secret123');
    cy.get('input[type="text"]').parent().find('button').click();
    cy.get('input[type="password"]').should('have.value', 'Secret123');
  });

  it('checks and unchecks Remember me', () => {
    cy.visit('/login');
    const rememberCheckbox = () => cy.contains('label', 'Remember me').find('input[type="checkbox"]');

    rememberCheckbox().check().should('be.checked');
    rememberCheckbox().uncheck().should('not.be.checked');
  });

  it('opens the password reset page from sign in', () => {
    cy.visit('/login');
    cy.contains('a', 'Forgot password?').click();

    cy.location('pathname').should('eq', '/forgot-password');
    cy.contains('h1', 'Reset Password').should('be.visible');
  });

  it('opens registration from the sign-in page', () => {
    cy.visit('/login');
    cy.contains('a', 'Register here').click();

    cy.location('pathname').should('eq', '/register');
    cy.contains('Create your staff account').should('be.visible');
  });

  it('shows the forgot-password form and returns to sign in', () => {
    cy.visit('/forgot-password');
    cy.contains('h1', 'Reset Password').should('be.visible');
    cy.get('input[type="email"]').should('be.visible').and('have.attr', 'required');
    cy.contains('button', 'Send Reset Link').should('be.enabled');

    cy.contains('a', 'Back to sign in').click();
    cy.location('pathname').should('eq', '/login');
  });

  it('keeps sign in pending during a slow rejected login and displays the server error', () => {
    cy.intercept('POST', '**/auth/v1/token*', {
      delay: 1500,
      statusCode: 400,
      body: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    }).as('signInRequest');

    cy.visit('/login');
    cy.get('input[type="email"]').type('operator@example.com', { delay: 80 });
    cy.get('input[type="password"]').type('incorrect-password', { delay: 80 });
    cy.contains('button', 'Sign In').click();

    cy.contains('button', 'Signing in...').should('be.disabled');
    cy.wait('@signInRequest').its('response.statusCode').should('eq', 400);
    cy.contains('Invalid login credentials').should('be.visible');
    cy.contains('button', 'Sign In').should('be.enabled');
    cy.location('pathname').should('eq', '/login');
  });
});
