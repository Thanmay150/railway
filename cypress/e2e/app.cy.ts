describe('RailQR AI landing page and routing', () => {
  it('renders the landing page hero', () => {
    cy.visit('/');

    cy.contains('h1', 'Laser-Based QR Marking for').should('be.visible');
    cy.contains('AI-Powered Railway Asset Management').should('be.visible');
  });

  it('navigates from the landing page to sign in', () => {
    cy.visit('/');
    cy.contains('a', 'Sign In').first().click();

    cy.location('pathname').should('eq', '/login');
    cy.contains('h2', 'Welcome Back').should('be.visible');
  });

  it('navigates from the landing page to registration', () => {
    cy.visit('/');
    cy.contains('a', 'Get Started').click();

    cy.location('pathname').should('eq', '/register');
    cy.contains('Create your staff account').should('be.visible');
  });

  it('shows the feature section', () => {
    cy.visit('/');

    cy.contains('h2', 'Everything you need to manage railway assets').scrollIntoView().should('be.visible');
    cy.contains('QR Code Generation').should('be.visible');
    cy.contains('AI Inspection').should('be.visible');
  });

  it('shows the stats section', () => {
    cy.visit('/');
    cy.get('#stats').scrollIntoView().should('be.visible');

    cy.contains('Track Fittings').should('be.visible');
    cy.contains('Railway Zones').should('be.visible');
  });

  it('redirects unauthenticated visitors away from protected pages', () => {
    cy.visit('/dashboard');

    cy.location('pathname').should('eq', '/login');
  });
});

const testUserId = '00000000-0000-4000-8000-000000000001';
const testFitting = {
  id: '00000000-0000-4000-8000-000000000010',
  component_id: 'FIT-TEST-001',
  qr_id: 'RQR-NR-000001',
  track_number: 'TRACK-101',
  railway_zone: 'NR',
  division: 'Delhi',
  section: 'New Delhi - Ghaziabad',
  station_name: 'New Delhi',
  component_type: 'Fish Plate',
  material: 'Carbon Steel',
  track_type: 'BG',
  manufacturer: 'Cypress Test Works',
  installation_date: '2025-01-10',
  last_inspection_date: '2026-01-10',
  maintenance_date: null,
  status: 'Active',
  gps_lat: 28.6139,
  gps_lng: 77.209,
  image_url: null,
  created_by: testUserId,
  created_at: new Date().toISOString(),
};
const reportInspections = [
  { id: 'inspection-pass', fit_id: testFitting.id, qr_id: testFitting.qr_id, result: 'PASS', confidence: 98, problems: [], image_url: null, inspector_id: testUserId, created_at: new Date().toISOString() },
  { id: 'inspection-fail', fit_id: testFitting.id, qr_id: testFitting.qr_id, result: 'FAIL', confidence: 62, problems: ['Low contrast'], image_url: null, inspector_id: testUserId, created_at: new Date().toISOString() },
];
const testComplaint = {
  id: '00000000-0000-4000-8000-000000000020',
  fit_id: testFitting.id,
  qr_id: testFitting.qr_id,
  complaint_type: 'Damaged QR Marking',
  priority: 'High',
  description: 'QR marking is difficult to scan near the north rail joint.',
  status: 'Open',
  registered_by: testUserId,
  resolved_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function visitAsTestUser(path: string) {
  const now = Math.floor(Date.now() / 1000);
  cy.visit(path, {
    onBeforeLoad(win) {
      const encode = (value: string) => win.btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const accessToken = `${encode('{"alg":"HS256","typ":"JWT"}')}.${encode(JSON.stringify({ sub: testUserId, aud: 'authenticated', role: 'authenticated', exp: now + 3600 }))}.cypress-signature`;
      win.localStorage.setItem('sb-ulgssidisrygdiantpyx-auth-token', JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'cypress-refresh-token',
        user: {
          id: testUserId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'cypress.operator@example.com',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { full_name: 'Cypress Operator' },
          created_at: new Date().toISOString(),
        },
      }));
    },
  });
}

function mockReportingApi(options: {
  slowFittings?: number;
  slowComplaints?: number;
  complaintRows?: () => unknown[];
} = {}) {
  cy.intercept('GET', '**/rest/v1/profiles*', (request) => {
    if (request.url.includes('role=eq.engineer')) {
      request.reply({ body: [{ id: testUserId, full_name: 'Cypress Engineer', role: 'engineer', zone: 'NR', created_at: new Date().toISOString() }] });
    } else {
      request.reply({ body: { id: testUserId, full_name: 'Cypress Operator', role: 'operator', zone: 'NR', created_at: new Date().toISOString() } });
    }
  });
  cy.intercept('GET', '**/rest/v1/track_fittings*', (request) => {
    const body = request.url.includes('or=') ? testFitting : [testFitting];
    request.reply({ delay: options.slowFittings ?? 0, body });
  }).as('trackFittings');
  cy.intercept('GET', '**/rest/v1/inspections*', { body: reportInspections });
  cy.intercept('GET', '**/rest/v1/maintenance_logs*', { body: [] });
  cy.intercept('GET', '**/rest/v1/complaints*', (request) => {
    request.reply({
      delay: options.slowComplaints ?? 0,
      headers: { 'content-range': '0-0/1' },
      body: options.complaintRows?.() ?? [testComplaint],
    });
  }).as('complaintsLoad');
  cy.intercept('POST', '**/rest/v1/audit_logs*', { statusCode: 201, body: [] });
  cy.intercept('POST', '**/rest/v1/notifications*', { statusCode: 201, body: [] });
}

describe('Detailed reports and complaint workflows', () => {
  it('shows report loading during a slow response, then filters component reports', () => {
    mockReportingApi({ slowFittings: 1200 });
    visitAsTestUser('/reports');

    cy.get('main .skeleton').should('exist');
    cy.wait('@trackFittings');
    cy.contains('h1', 'Reports').should('be.visible');
    cy.contains('FIT-TEST-001').should('be.visible');
    cy.contains('RQR-NR-000001').should('be.visible');
    cy.contains('Station').parent().should('contain.text', 'New Delhi');

    cy.contains('button', 'Filters').click();
    cy.get('input[placeholder="Component or QR ID..."]').type('does-not-exist');
    cy.contains('No reports available').should('be.visible');
    cy.contains('button', 'Clear all filters').click();
    cy.contains('FIT-TEST-001').should('be.visible');

    cy.get('select').select('WR');
    cy.contains('No reports available').should('be.visible');
    cy.contains('button', 'Clear all filters').click();
    cy.contains('FIT-TEST-001').should('be.visible');
  });

  it('calculates summary metrics and switches report periods', () => {
    mockReportingApi();
    visitAsTestUser('/reports');
    cy.wait('@trackFittings');
    cy.contains('button', 'Summary').click();

    cy.contains('h3', 'Period Summary').should('be.visible');
    cy.contains('span', 'Components').parent().parent().should('contain.text', '1');
    cy.contains('span', 'Inspections').parent().parent().should('contain.text', '2');
    cy.contains('span', 'Pass Rate').parent().parent().should('contain.text', '50%');
    cy.contains('span', 'Passed').parent().parent().should('contain.text', '1');
    cy.contains('span', 'Failed').parent().parent().should('contain.text', '1');

    cy.contains('button', 'Weekly').click();
    cy.contains('button', 'Download weekly PDF Report').should('be.visible');
    cy.contains('button', 'Engineer').click();
    cy.contains('h3', 'Engineer Performance').should('be.visible');
    cy.contains('Cypress Engineer').should('be.visible');
  });

  it('loads complaints slowly, updates status, and shows the complaint timeline', () => {
    let currentStatus = 'Open';
    mockReportingApi({
      slowComplaints: 1000,
      complaintRows: () => {
        const resolved = currentStatus === 'Resolved' ? new Date().toISOString() : null;
        return [{ ...testComplaint, status: currentStatus, resolved_at: resolved, updated_at: new Date().toISOString() }];
      },
    });
    cy.intercept('PATCH', '**/rest/v1/complaints*', (request) => {
      currentStatus = request.body.status;
      request.reply({ statusCode: 204, body: '' });
    }).as('updateComplaint');
    visitAsTestUser('/complaints');

    cy.contains('Loading complaints...').should('be.visible');
    cy.wait('@complaintsLoad');
    cy.contains('FIT-TEST-001').should('be.visible');
    cy.contains('Damaged QR Marking').should('be.visible');
    cy.contains(testComplaint.description).should('be.visible');
    cy.contains('button', 'Start').click();
    cy.wait('@updateComplaint').its('request.body.status').should('eq', 'In Progress');
    cy.contains('Loading complaints...').should('be.visible');
    cy.wait('@complaintsLoad');
    cy.contains('button', 'Resolve').click();
    cy.wait('@updateComplaint').its('request.body.status').should('eq', 'Resolved');
    cy.wait('@complaintsLoad');
    cy.contains('button', 'View timeline').click();
    cy.contains('Complaint Registered').should('be.visible');
    cy.contains('Complaint Resolved').should('be.visible');
  });

  it('registers a detailed complaint after a slow save response', () => {
    let submittedComplaint: Record<string, unknown> | null = null;
    mockReportingApi({ complaintRows: () => submittedComplaint ? [submittedComplaint] : [testComplaint] });
    cy.intercept('POST', '**/rest/v1/complaints*', (request) => {
      submittedComplaint = request.body;
      request.reply({ delay: 1200, statusCode: 201, body: [] });
    }).as('saveComplaint');
    visitAsTestUser('/scanner');

    cy.get('input[placeholder="RQR-XXX-XXXXXX or FIT-123456"]').type('RQR-NR-000001', { delay: 45 });
    cy.contains('button', 'Lookup').click();
    cy.contains('Component found').should('be.visible');
    cy.contains('FIT-TEST-001').should('be.visible');
    cy.contains('button', 'Register Complaint').click();
    cy.contains('h3', 'Register Complaint').should('be.visible');

    cy.contains('h3', 'Register Complaint').parent().parent().within(() => {
      cy.contains('label', 'Complaint Type').parent().find('select').select('Loose Fitting');
      cy.contains('label', 'Priority').parent().find('select').select('Critical');
      cy.get('textarea[placeholder="Describe the issue in detail..."]').type('The fitting has shifted and the QR marking is partially damaged.', { delay: 35 });
      cy.contains('button', 'Register Complaint').click();
    });
    cy.contains('button', 'Registering...').should('be.disabled');

    cy.wait('@saveComplaint').then(({ request }) => {
      expect(request.body).to.include({
        fit_id: testFitting.id,
        qr_id: testFitting.qr_id,
        complaint_type: 'Loose Fitting',
        priority: 'Critical',
        status: 'Open',
        registered_by: testUserId,
      });
      expect(request.body.description).to.contain('partially damaged');
    });
    cy.contains('Complaint registered successfully').should('be.visible');
    cy.contains('Loose Fitting').should('be.visible');
    cy.contains('Critical').should('be.visible');
  });
});
