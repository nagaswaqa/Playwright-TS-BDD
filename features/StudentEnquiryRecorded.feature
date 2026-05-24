@StudentEnquiry
@recording
@security
Feature: 1 Campus Student Information System

  Background:
    Given the application is open

  Scenario: Recorded user flow
    When I navigate to the "Student Management" section
    When I open the "Student Details" modal
    When I select "Walk‑in" from the "Admission Type" dropdown
    When I select "General" from the "Program Type" dropdown
    When I select "Undergraduate" from the "Level" dropdown
    When I select "BSc Physics" from the "Major" dropdown
    When I select "Francistown" from the "Location" dropdown
    When I select "2026-06-15" from the "Enrollment Date" datepicker
