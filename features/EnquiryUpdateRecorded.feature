@EnquiryUpdate
@recording
Feature: 1 Campus - Student Information System

  Background:
    Given the application is open

  Scenario: Recorded user flow
    When I navigate to the "Recruitment" section
    When I navigate to the "Enquiries" section
    When I edit the enquiry row matching "ENQ-2026-0015"
    When I select "BSc Mathematics" from the "Programme of Interest (optional)" dropdown
    When I save the changes
