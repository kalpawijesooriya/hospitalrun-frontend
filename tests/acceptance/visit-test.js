import { click, fillIn, currentURL, find, visit, waitUntil, settled as wait } from '@ember/test-helpers';
import { findWithAssert } from 'ember-native-dom-helpers';
import { isEmpty } from '@ember/utils';
import moment from 'moment';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import runWithPouchDump from 'hospitalrun/tests/helpers/run-with-pouch-dump';
import select from 'hospitalrun/tests/helpers/select';
import typeAheadFillIn from 'hospitalrun/tests/helpers/typeahead-fillin';
import { waitToAppear, waitToDisappear } from 'hospitalrun/tests/helpers/wait-to-appear';
import { authenticateUser } from 'hospitalrun/tests/helpers/authenticate-user';
import {
  createCustomFormForType,
  attachCustomForm,
  fillCustomForm,
  checkCustomFormIsFilledAndReadonly
} from 'hospitalrun/tests/helpers/scenarios/custom-forms';
import jquerySelect from 'hospitalrun/tests/helpers/deprecated-jquery-select';
import jqueryLength from 'hospitalrun/tests/helpers/deprecated-jquery-length';

const LOCATION = 'Springfield Hospital';
const EXAMINER = 'Sarah Kearney';
const PRIMARY_DIAGNOSIS = 'ACL deficient knee, right';
const SECONDARY_DIAGNOSIS = 'ACL deficient knee, left';
const OPERATION_DESCRIPTION = 'Describe Operation here';
const PROCEDURE_SPLINT = 'application of long arm post splint';
const ADMISSION_INSTRUCTIONS = 'Admission Instructions here';
const OPD_PROCEDURE_DESCRIPTION = 'Bilateral knee Release';
const OPD_PROCEDURE_PHYSICIAN = 'Sarah Kearney';
const LAB_TYPE = 'Cholesterol';
const IMAGING_TYPE = 'Cervical Spine AP-L';
const APPOINTMENT_START_DATE = moment().add(7, 'days').format('l h =mm A');
const APPOINTMENT_END_DATE = moment().add(8, 'days').format('l h =mm A');
const NOTE_CONTENT = 'OPD notes are entered here';
const PATIENT = 'Joe Bagadonuts';
const PATIENT_ID = 'P00001';

const opdReportTestCases = {
  'Add OPD visit': {},
  'OPD report with always included custom form': {
    customForms: [{ type: 'Lab', alwaysIncluded: true, name: 'Test Custom Form for Lab included' }]
  },
  'OPD report with a custom form': {
    customForms: [{ type: 'Lab', alwaysIncluded: false, name: 'Test Custom Form for Lab NOT included' }]
  },
  'OPD report with always included and regular custom forms': {
    customForms: [
      { type: 'Lab', alwaysIncluded: true, name: 'Test Custom Form for Lab included' },
      { type: 'Lab', alwaysIncluded: false, name: 'Test Custom Form for Lab NOT included' }
    ]
  }
};

module('Acceptance | visits', function(hooks) {
  setupApplicationTest(hooks);

  test('Add admission visit', function(assert) {
    return runWithPouchDump('patient', async function() {
      await authenticateUser();
      await addVisit(assert);
      await addAdmissionData(assert);
      await newReport(assert, 'Discharge');
      await checkDischargeReport(assert);
      await saveReport(assert, 'Discharge');
      await viewReport(assert, 'Discharge');
    });
  });

  for (let testCase in opdReportTestCases) {
    test(testCase, function(assert) {
      return runWithPouchDump('patient', async function() {
        await authenticateUser();

        for (let f of (opdReportTestCases[testCase].customForms || [])) {
          await createCustomFormForType(f.type, f.alwaysIncluded);
        }

        await addVisit(assert, 'Clinic');
        await addOutpatientData(assert, opdReportTestCases[testCase]);
        await newReport(assert, 'OPD');
        await checkOPDReport(assert);
        await saveReport(assert, 'OPD');
        await viewReport(assert, 'OPD', opdReportTestCases[testCase]);
      });
    });
  }

  test('Edit visit', function(assert) {
    return runWithPouchDump('patient', async function() {
      await authenticateUser();
      await visit('/patients');
      assert.equal(currentURL(), '/patients', 'Patient url is correct');

      await click(jquerySelect('button:contains(Edit)'));
      assert.dom('.patient-name .ps-info-data').hasText('Joe Bagadonuts', 'Joe Bagadonuts patient record displays');

      await click('[data-test-selector=visits-tab]');
      await waitToAppear('#visits button:contains(Edit)');
      await click(jquerySelect('#visits button:contains(Edit)'));

      await waitUntil(() => currentURL() === '/visits/edit/03C7BF8B-04E0-DD9E-9469-96A5604F5340');

      assert.equal(currentURL(), '/visits/edit/03C7BF8B-04E0-DD9E-9469-96A5604F5340', 'Visit url is correct');

      await click(jquerySelect('a:contains(Add Allergy)'));
      await waitToAppear('.modal-dialog');
      assert.dom('.modal-title').hasText('Add Allergy', 'Add Allergy dialog displays');

      await fillIn('.test-allergy input', 'Oatmeal');
      await click(jquerySelect('.modal-footer button:contains(Add)'));
      await waitToDisappear('.modal-dialog');
      assert.equal(jqueryLength('a.allergy-button:contains(Oatmeal)'), 1, 'New allergy appears');

      await click(jquerySelect('a:contains(Add Diagnosis)'));
      await waitToAppear('.modal-dialog');
      assert.dom('.modal-title').hasText('Add Diagnosis', 'Add Diagnosis dialog displays');

      await fillIn('.diagnosis-text input', 'Broken Arm');
      await click(jquerySelect('.modal-footer button:contains(Add)'));
      await waitToAppear('a.primary-diagnosis');
      assert.equal(jqueryLength('a.primary-diagnosis:contains(Broken Arm)'), 1, 'New primary diagnosis appears');

      await click(jquerySelect('button:contains(New Medication)'));
      assert.equal(currentURL(), '/medication/edit/new?forVisitId=03C7BF8B-04E0-DD9E-9469-96A5604F5340', 'New medication url is correct');
      assert.dom('.patient-name .ps-info-data').hasText('Joe Bagadonuts', 'New medication prepopulates with patient');

      await click(jquerySelect('button:contains(Cancel)'));

      await waitUntil(() => currentURL().includes('/visits/edit/03C7BF8B-04E0-DD9E-9469-96A5604F5340'));

      await click(jquerySelect('button:contains(New Lab)'));

      await waitUntil(() => currentURL().includes('/labs/edit/new?forVisitId=03C7BF8B-04E0-DD9E-9469-96A5604F5340'));

      assert.equal(currentURL(), '/labs/edit/new?forVisitId=03C7BF8B-04E0-DD9E-9469-96A5604F5340', 'New lab url is correct');
      assert.dom('.patient-name .ps-info-data').hasText('Joe Bagadonuts', 'New lab prepopulates with patient');

      await click(jquerySelect('button:contains(Cancel)'));

      await waitUntil(() => currentURL() === '/visits/edit/03C7BF8B-04E0-DD9E-9469-96A5604F5340');

      await click(jquerySelect('button:contains(New Imaging)'));

      await waitUntil(() => currentURL() === '/imaging/edit/new?forVisitId=03C7BF8B-04E0-DD9E-9469-96A5604F5340');

      assert.equal(currentURL(), '/imaging/edit/new?forVisitId=03C7BF8B-04E0-DD9E-9469-96A5604F5340', 'New imaging url is correct');
      assert.dom('.patient-name .ps-info-data').hasText('Joe Bagadonuts', 'New imaging prepopulates with patient');

      await click(jquerySelect('button:contains(Cancel)'));

      await waitUntil(() => currentURL() === '/visits/edit/03C7BF8B-04E0-DD9E-9469-96A5604F5340');

      await click(jquerySelect('button:contains(New Vitals)'));
      waitToAppear('.modal-dialog');

      await fillIn('.temperature-text input', '34.56');
      await fillIn('.weight-text input', '34.56');
      await fillIn('.height-text input', '34.56');
      await fillIn('.sbp-text input', '34.56');
      await fillIn('.dbp-text input', '34.56');
      await fillIn('.heart-rate-text input', '34.56');
      await fillIn('.respiratory-rate-text input', '34.56');
      await click(jquerySelect('.modal-footer button:contains(Add)'));
      await waitToAppear('#visit-vitals tr:last td:contains(34.56)');
      assert.equal(jqueryLength('#visit-vitals tr:last td:contains(34.56)'), 7, 'New vitals appears');

      await click(jquerySelect('button:contains(Add Item)'));
      await waitToAppear('.modal-dialog');
      await typeAheadFillIn('.charge-item-name', 'Gauze pad');
      await click(jquerySelect('.modal-footer button:contains(Add)'));
      await waitToDisappear('.modal-dialog');
      await waitToAppear('td.charge-item-name');
      assert.dom('td.charge-item-name').hasText('Gauze pad', 'New charge item appears');

      await updateVisit(assert, 'Update');
      await click(jquerySelect('a.primary-diagnosis:contains(Broken Arm)'));
      await waitToAppear('.modal-dialog');
      assert.dom('.modal-title').hasText('Edit Diagnosis', 'Edit Diagnosis modal appears');
      assert.equal(jqueryLength('.modal-footer button:contains(Delete)'), 1, 'Delete button appears');

      await click(jquerySelect('.modal-footer button:contains(Delete)'));
      await waitToDisappear('.modal-dialog');
      await click(jquerySelect('#visit-vitals tr:last button:contains(Delete)'));
      await waitToAppear('.modal-dialog');
      assert.dom('.modal-title').hasText('Delete Vitals', 'Delete Vitals dialog displays');

      await click(jquerySelect('.modal-footer button:contains(Delete)'));
      await click('[data-test-selector=charges-tab]');
      await click(jquerySelect('.charge-items tr:last button:contains(Delete)'));
      await waitToAppear('.modal-dialog');
      assert.dom('.modal-title').hasText('Delete Charge Item', 'Delete Charge Item dialog displays');

      await click(jquerySelect('.modal-footer button:contains(Ok)'));
      await waitToDisappear('.modal-dialog');
      assert.equal(jqueryLength('a.primary-diagnosis:contains(Broken Arm)'), 0, 'New primary diagnosis is deleted');
      assert.equal(jqueryLength('#visit-vitals tr:last td:contains(34.56)'), 0, 'Vital is deleted');
      assert.dom('td.charge-item-name').doesNotExist('Charge item is deleted');
    });
  });

  test('Delete visit', function(assert) {
    return runWithPouchDump('patient', async function() {
      await authenticateUser();
      await visit('/patients');
      assert.equal(currentURL(), '/patients', 'Patient url is correct');

      await click(jquerySelect('button:contains(Edit)'));
      assert.dom('.patient-name .ps-info-data').hasText('Joe Bagadonuts', 'Joe Bagadonuts patient record displays');

      await click('[data-test-selector=visits-tab]');
      await waitToAppear('#visits button:contains(Delete)'); // Make sure visits have been retrieved.
      assert.dom('#visits tr').exists({ count: 2 }, 'One visit is displayed to delete');

      await click(jquerySelect('#visits button:contains(Delete)'));
      await waitToAppear('.modal-dialog');
      assert.dom('.modal-title').hasText('Delete Visit', 'Delete Visit confirmation displays');

      await click(jquerySelect('.modal-footer button:contains(Delete)'));
      await waitToDisappear('.modal-dialog');
      await waitToDisappear('#visits td:contains(Fall from in-line roller-skates, initial encounter)');
      assert.dom('#visits tr').exists({ count: 1 }, 'Visit is deleted');
    });
  });

  async function addVisit(assert, type) {
    await visit('/patients');
    assert.equal(currentURL(), '/patients', 'Patient url is correct');

    await click(jquerySelect('button:contains(Edit)'));
    assert.dom('.patient-name .ps-info-data').hasText(PATIENT, `${PATIENT} patient record displays`);

    await click('[data-test-selector=visits-tab]');
    await waitToAppear('#visits button:contains(Edit)');

    await click(jquerySelect('#visits button:contains(New Visit)'));
    await waitToAppear('#visit-info');
    assert.dom('.patient-name .ps-info-data').hasText(PATIENT, `${PATIENT} displays as patient for visit`);

    await updateVisit(assert, 'Add', type);
  }

  async function addOutpatientData(assert, testCase) {
    await typeAheadFillIn('.visit-location', LOCATION);
    await typeAheadFillIn('.visit-examiner', EXAMINER);
    await click(jquerySelect('a:contains(Add Diagnosis)'));
    await waitToAppear('.modal-dialog');
    assert.dom('.modal-title').hasText('Add Diagnosis', 'Add Diagnosis dialog displays');

    await fillIn('.diagnosis-text input', PRIMARY_DIAGNOSIS);
    await click(jquerySelect('.modal-footer button:contains(Add)'));
    await waitToDisappear('.modal-dialog');
    await click(jquerySelect('a:contains(Add Diagnosis)'));
    await waitToAppear('.modal-dialog');
    assert.dom('.modal-title').hasText('Add Diagnosis', 'Add Diagnosis dialog displays');

    await fillIn('.diagnosis-text input', SECONDARY_DIAGNOSIS);
    await click('.secondary-diagnosis input');
    await click(jquerySelect('.modal-footer button:contains(Add)'));
    await waitToDisappear('.modal-dialog');
    await waitToAppear(`a.secondary-diagnosis:contains(${SECONDARY_DIAGNOSIS})`);
    await click(jquerySelect('a:contains(Add Operative Plan)'));

    await waitUntil(() => currentURL().includes('/patients/operative-plan/new?forVisitId'));

    assert.ok(currentURL().includes('/patients/operative-plan/new?forVisitId'), 'New operative plan URL is visited');
    assert.dom('.patient-name .ps-info-data').hasText(PATIENT, `${PATIENT} patient header displays`);
    assert.dom('.view-current-title').hasText('New Operative Plan', 'New operative plan title is correct');

    await fillIn('.operation-description textarea', OPERATION_DESCRIPTION);
    await typeAheadFillIn('.procedure-description', PROCEDURE_SPLINT);
    await click(jquerySelect('button:contains(Add Procedure)'));
    await waitToAppear('.procedure-listing td.procedure-description');
    await fillIn('.admission-instructions textarea', ADMISSION_INSTRUCTIONS);
    await updateVisitData(assert, 'Plan Saved');
    await click('[data-test-selector=procedures-tab]');
    await waitToAppear('[data-test-selector=new-procedure-btn]');
    assert.dom('[data-test-selector=new-procedure-btn]').hasText('New Procedure', 'New Procedure button displayed');

    await click('[data-test-selector=new-procedure-btn]');

    await waitUntil(() => currentURL().includes('/visits/procedures/edit/new?forVisitId'));

    assert.ok(currentURL().includes('/visits/procedures/edit/new?forVisitId'), 'New Procedures URL is visited');

    await typeAheadFillIn('.procedure-description', OPD_PROCEDURE_DESCRIPTION);
    await typeAheadFillIn('.procedure-physician', OPD_PROCEDURE_PHYSICIAN);
    await updateVisitData(assert, 'Procedure Saved');
    await click(jquerySelect('button:contains(New Lab)'));

    await waitUntil(() => currentURL().includes('/labs/edit/new?forVisitId'));

    assert.ok(currentURL().includes('/labs/edit/new?forVisitId'), 'New Lab URL is visited');

    await typeAheadFillIn('.test-lab-type', LAB_TYPE);

    for (let f of (testCase.customForms || [])) {
      if (!f.alwaysIncluded) {
        await attachCustomForm(f.name);
      }
      await fillCustomForm(f.name);
    }

    await updateVisitData(assert, 'Lab Request Saved');
    await click(jquerySelect('button:contains(New Imaging)'));

    await waitUntil(() => currentURL().includes('/imaging/edit/new?forVisitId'));

    assert.ok(currentURL().includes('/imaging/edit/new?forVisitId'), 'New Imaging URL is visited');

    await typeAheadFillIn('.imaging-type-input', IMAGING_TYPE);
    await updateVisitData(assert, 'Imaging Request Saved');
    await click(jquerySelect('button:contains(New Appointment)'));

    await waitUntil(() => currentURL().includes('/appointments/edit/new?forVisitId'));
    assert.ok(currentURL().includes('/appointments/edit/new?forVisitId'), 'New Appointment URL is visited');

    await click('.appointment-all-day input');
    await fillIn('.test-appointment-start input', APPOINTMENT_START_DATE);
    await fillIn('.test-appointment-end input', APPOINTMENT_END_DATE);
    await updateVisitData(assert, 'Appointment Saved');
    await click('[data-test-selector=notes-tab]');
    await waitToAppear('[data-test-selector=new-note-btn]');
    await click('[data-test-selector=new-note-btn]');
    assert.dom('.modal-title').hasText(`New Note for ${PATIENT}`, 'New Note dialog displays');

    await fillIn('.test-note-content textarea', NOTE_CONTENT);
    await click(jquerySelect('.modal-footer button:contains(Add)'));
    await waitToDisappear('.modal-dialog');

    await waitUntil(() => currentURL().includes('/visits/edit/'));

    assert.ok(currentURL().includes('/visits/edit/'), 'Returns back to visit URL');
  }

  async function addAdmissionData(assert) {
    await typeAheadFillIn('.visit-examiner', EXAMINER);
    await click('[data-test-selector=notes-tab]');
    await waitToAppear('[data-test-selector=new-note-btn]');
    await click('[data-test-selector=new-note-btn]');
    assert.dom('.modal-title').hasText('New Note for Joe Bagadonuts', 'New Note dialog displays');

    await fillIn('.test-note-content textarea', NOTE_CONTENT);
    await click(jquerySelect('.modal-footer button:contains(Add)'));
    await waitToDisappear('.modal-dialog');
    assert.ok(currentURL().indexOf('visits/edit/') > -1, 'Returns back to visit URL');
  }

  async function newReport(assert, type) {
    await click('[data-test-selector=reports-tab]');
    await waitToAppear('[data-test-selector=report-btn]');
    assert.dom('[data-test-selector=report-btn]').hasText(
      `New ${type} Report`,
      'Discharge report can be created for this type of visit'
    );

    await click('[data-test-selector=report-btn]');

    await waitUntil(() => currentURL().includes('visits/reports/edit/new'));

    assert.ok(currentURL().includes('visits/reports/edit/new'), 'Report url is correct');
    assert.dom('.view-current-title').hasText(`New ${type} Report`, `${type} report title displayed correctly`);
    assert.dom('.patient-name .ps-info-data').hasText(PATIENT, 'Patient record displays');
  }

  function checkOPDReport(assert) {
    assert.dom('.patient-id .ps-info-data').hasText(PATIENT_ID, 'Patient ID is displayed');
    assert.dom('.patient-name .ps-info-data').hasText(PATIENT, 'Patient First Name & Last Name is displayed');
    assert.dom('.test-visit-date .test-visit-date-label').hasText('Date of Visit:', 'Visit date label displayed');
    assert.ok(!isEmpty(find('.test-visit-date .test-visit-date-data').textContent), 'Visit date is displayed');
    findWithAssert(jquerySelect('.test-visit-type .test-visit-type-label:contains(Visit Type)'));
    assert.dom('.test-visit-type .test-visit-type-data').hasText('Clinic', 'Visit Type is displayed');
    findWithAssert(jquerySelect('.test-examiner .test-examiner-label:contains(Examiner)'));
    assert.dom('.test-examiner .test-examiner-data').hasText(EXAMINER, 'Visit Examiner is displayed');
    findWithAssert(jquerySelect('.test-location .test-location-label:contains(Visit Location)'));
    assert.dom('.test-location .test-location-data').hasText(LOCATION, 'Visit Location is displayed');
    findWithAssert(jquerySelect(`.primary-diagnosis:contains(${PRIMARY_DIAGNOSIS})`));
    findWithAssert(jquerySelect(`.secondary-diagnosis:contains(${SECONDARY_DIAGNOSIS})`));
    findWithAssert(jquerySelect('.test-opd-procedure .test-opd-procedure-label:contains(Procedures)'));
    assert.ok(find('.test-opd-procedure .test-opd-procedure-data').textContent.indexOf(OPD_PROCEDURE_DESCRIPTION) > -1, 'OPD Procedure is displayed');
    findWithAssert(jquerySelect('.test-labs .test-labs-label:contains(Labs)'));
    assert.ok(find('.test-labs .test-labs-data').textContent.indexOf(LAB_TYPE) > -1, 'Lab request is displayed');
    findWithAssert(jquerySelect('.test-images .test-images-label:contains(Images)'));
    assert.ok(find('.test-images .test-images-data').textContent.indexOf(IMAGING_TYPE) > -1, 'Image request is displayed');
    findWithAssert(jquerySelect('.test-operative-plan .test-operative-plan-label:contains(Operative Plan)'));
    findWithAssert(jquerySelect('.test-operative-plan .test-operative-plan-description-label:contains(Operation Description:)'));
    assert.dom('.test-operative-plan .test-operative-plan-description-data').hasText(OPERATION_DESCRIPTION);
    findWithAssert(jquerySelect('.test-operative-plan .test-operative-plan-procedures-label:contains(Planned Procedures:)'));
    assert.dom('.test-operative-plan .test-operative-plan-procedures-description').hasText(PROCEDURE_SPLINT);
    findWithAssert(jquerySelect('.test-operative-plan .test-operative-plan-instructions-label:contains(Instructions upon Admission:)'));
    assert.dom('.test-operative-plan .test-operative-plan-instructions-data').hasText(ADMISSION_INSTRUCTIONS, 'Admission Instruction is displayed');
  }

  function checkDischargeReport(assert) {
    findWithAssert(jquerySelect('.test-examiner .test-examiner-label:contains(Examiner)'));
    assert.dom('.test-examiner .test-examiner-data').hasText(EXAMINER, 'Examiner is displayed');
    assert.dom('.test-visit-date .test-visit-date-label').hasText('Admission Date:', 'Visit date label displays as admission');
    assert.dom('.test-visit-date .test-visit-discharge-date-label').hasText('Discharge Date:', 'Discharge date label displays');
    findWithAssert(jquerySelect('.test-notes .test-notes-label:contains(Notes)'));
    assert.dom('.test-notes .test-notes-data').containsText(NOTE_CONTENT, 'Notes are displayed');
  }

  async function saveReport(assert, type) {
    await click(jquerySelect('.panel-footer button:contains(Add)'));
    await waitToAppear('.modal-dialog');
    assert.dom('.modal-title').hasText('Report saved', `${type} report saved successfully`);

    await click(jquerySelect('button:contains(Ok)'));
    await waitToDisappear('.modal-dialog');
    assert.dom('.view-current-title').hasText(`${type} Report`, 'Report title updated correctly');
    assert.dom(jquerySelect('.panel-footer button:contains(Print)')).isVisible('Print button is now visible');

    await click(jquerySelect('button:contains(Return)'));

    await waitUntil(() => currentURL().includes('/visits/edit'));

    assert.ok(currentURL().includes('/visits/edit'), 'Visit url is correct');
  }

  async function viewReport(assert, type, testCase) {
    await click('[data-test-selector=reports-tab]');
    await waitToAppear('[data-test-selector=view-report-btn]');
    await click('[data-test-selector=view-report-btn]');

    assert.ok(currentURL().indexOf('visits/reports/edit') > -1, 'Edit report url is correct');
    assert.dom('.patient-name .ps-info-data').hasText(PATIENT, 'Patient record displays');
    assert.dom('.view-current-title').hasText(`${type} Report`, 'Report title displayed correctly');
    assert.dom(jquerySelect('.panel-footer button:contains(Print)')).isVisible('Print button is visible');

    for (let f of (testCase && testCase.customForms || [])) {
      await checkCustomFormIsFilledAndReadonly(assert, f.name);
    }

    // necessary for passing the electron tests
    await wait();
  }

  async function updateVisitData(assert, modalTitle) {
    await click(jquerySelect('.panel-footer button:contains(Add)'));
    await waitToAppear('.modal-dialog');
    assert.dom('.modal-title').hasText(modalTitle, `${modalTitle} modal displays`);

    await click(jquerySelect('.modal-footer button:contains(Ok)'));
    await waitToDisappear('.modal-dialog');
    await click(jquerySelect('button:contains(Return)'));

    await waitUntil(() => currentURL().includes('/visits/edit'));

    assert.ok(currentURL().includes('/visits/edit/'), 'Returns back to visit URL');
  }

  async function updateVisit(assert, buttonText, visitType) {
    if (visitType) {
      await select('select[id*="visitType"]', visitType);
      await waitToDisappear('label[for*="display_endDate"]');
    }
    await click(jquerySelect(`.panel-footer button:contains(${buttonText})`));
    await waitToAppear('.modal-dialog');
    assert.dom('.modal-title').hasText('Visit Saved', 'Visit Saved dialog displays');

    await click(jquerySelect('button:contains(Ok)'));
  }
});
