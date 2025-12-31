@regression
Feature: Tags Demonstration

  Background:
    Given I fetch user details from API for user 1
    Then I store the user name in the test context

  @api @regression
  Scenario: API Scenario Demonstration
    Given I fetch user details from API for user 1
    Then I store the user name in the test context

  @ui @regression
  Scenario: UI Scenario Demonstration
    When I navigate to the search page
    Then I should be able to use the stored user name for searching

  @smoke @ui
  Scenario: Smoke UI Scenario
    When I navigate to the search page
    Then I should be able to use the stored user name for searching
