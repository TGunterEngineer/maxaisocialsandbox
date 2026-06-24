# Welcome to your Lovable project

TODO: Document your project here
+----------------------------------+
                       |       [ ORGANIZATIONS ]          |
                       |  - id (UUID, PK)                 |
                       |  - plan_tier / plan_status       |
                       |  - review_gating_enabled (BOOL)  |
                       +----------------------------------+
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼ (1:N)                      ▼ (1:N)                      ▼ (1:N)
+-----------------------+    +-----------------------+    +-----------------------+
|    [ PROFILES ]       |    |     [ LOCATIONS ]     |    |  [ A2P_REGISTRATIONS ]|
| - id (UUID, PK)       |    | - id (UUID, PK)       |    | - id (UUID, PK)       |
| - user_id (UUID)      |    | - name / address      |    | - twilio_brand_sid    |
| - organization_id     |    | - google_review_url   |    | - twilio_campaign_sid |
+-----------------------+    +-----------------------+    +-----------------------+
                                        │                            │
                                        ▼ (1:N)                      ▼ (Sends via)
                             +-----------------------+    +-----------------------+
                             |  [ CUSTOMER_REVIEWS ] |    |    [ CAMPAIGNS ]      |
                             | - id (UUID, PK)       |    | - id (UUID, PK)       |
                             | - source (Yelp/Google)|    | - status / channel    |
                             | - sentiment / rating  |    | - message_body        |
                             +-----------------------+    +-----------------------+
                                                                     │
                                                                     ▼ (1:N Triggers)
                                                          +-----------------------+
                                                          | [ CAMPAIGN_RECIPIENTS]|
                                                          | - id (UUID, PK)       |
                                                          | - phone / send_status |
                                                          | - rating_token (TEXT) |
                                                          +-----------------------+

===================================================================================
🔄 DECOUPLED EVENT-DRIVEN WEBHOOK GENERATION & TRANSACTION PIPELINE
===================================================================================

 [System Status Mutation] ───► [Enforces Multi-Tenant Database RLS Isolation Boundaries]
                                              │
                                              ▼
 [Trigger Event Condition] ───► [Generates Webhook Payload & Records Delivery State]
                                              │
                                              ▼
 [WEBHOOK_ENDPOINTS] ────────► [Matches Target URL Destination & active_boolean Flags]
                                              │
                                              ▼
 [WEBHOOK_DELIVERIES] ───────► [Enforces Asynchronous Retry Loops via max_attempts R
