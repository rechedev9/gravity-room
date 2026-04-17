# Spec — insights

This spec describes the `insights` capability: the authenticated read endpoint that exposes pre-computed user insights to clients.

## Requirements

### Requirement: `GET /insights` SHALL validate the `types` query parameter against the closed set of known insight types

The closed set is: `volume_trend`, `frequency`, `plateau_detection`, `load_recommendation`.

Validation applies only when `types` is present. An absent or empty `types` parameter is valid and means "all types".

The parameter is a comma-separated list. Each trimmed, non-empty entry is validated independently.

#### Scenario: Client requests all known types explicitly

- **Given** an authenticated user with insights of multiple types stored
- **When** the client sends `GET /insights?types=volume_trend,frequency`
- **Then** the response status is `200`
- **And** the `data` array contains only rows whose `insightType` is `volume_trend` or `frequency`

#### Scenario: Client omits the `types` parameter

- **Given** an authenticated user with insights stored
- **When** the client sends `GET /insights`
- **Then** the response status is `200`
- **And** the `data` array contains all of the user's insights regardless of type

#### Scenario: Client sends an empty `types` value

- **Given** an authenticated user with insights stored
- **When** the client sends `GET /insights?types=`
- **Then** the response status is `200`
- **And** the response is equivalent to omitting the `types` parameter

#### Scenario: Client sends a single unknown type

- **Given** an authenticated user
- **When** the client sends `GET /insights?types=bogus`
- **Then** the response status is `400`
- **And** the response body identifies `bogus` as the invalid value
- **And** the response body lists the valid values: `volume_trend`, `frequency`, `plateau_detection`, `load_recommendation`
- **And** no database query for insights is issued

#### Scenario: Client mixes a valid and an unknown type

- **Given** an authenticated user
- **When** the client sends `GET /insights?types=frequency,bogus`
- **Then** the response status is `400`
- **And** the response body identifies `bogus` as the invalid value
- **And** no partial results are returned

#### Scenario: Client sends a known type with surrounding whitespace

- **Given** an authenticated user with a `frequency` insight stored
- **When** the client sends `GET /insights?types=%20frequency%20` (whitespace-padded)
- **Then** the response status is `200`
- **And** the `data` array contains the `frequency` row

### Requirement: A `400` response from `GET /insights` SHALL carry a machine-readable error describing the failure

The error payload is sufficient for a client to programmatically detect "invalid insight type" without parsing a human-readable string.

#### Scenario: Error payload shape

- **Given** any request that fails validation with an unknown type
- **When** the server responds with `400`
- **Then** the response body includes a stable error identifier for "invalid insight type" (`code === 'INVALID_INSIGHT_TYPE'`)
- **And** the response body includes the offending value(s) under `invalidValues`
- **And** the response body includes the full list of valid values under `validValues`

## History

- `2026-04-17` — Initial spec, promoted from change `validate-insights-types-query` (see archive).
