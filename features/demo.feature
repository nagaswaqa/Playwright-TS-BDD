Feature: Demo Framework Functionality

  @smoke @API-UI-Integration
  Scenario: Verify API and UI integration with shared context
    Given I fetch user details from API for user 1
    Then I store the user name in the test context
    When I navigate to the search page
    Then I should be able to use the stored user name for searching
