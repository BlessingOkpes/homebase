-- ============================================================
--  HomeBase Database Schema — Version 2.0
--  UPDATED: Landlord confirmation flow, anti-fraud design,
--           phone-first landlord registration
--  Database: MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS homebase_db;
USE homebase_db;

-- ============================================================
-- TABLE 1: users
-- Stores all registered users (tenants, landlords, admins)
-- CHANGE v2: phone_number is now NOT NULL (required for landlords)
--            email is now nullable (optional for landlords)
--            monthly_salary replaces monthly_income
-- ============================================================
CREATE TABLE users (
    user_id          INT AUTO_INCREMENT PRIMARY KEY,
    first_name       VARCHAR(100)  NOT NULL,
    last_name        VARCHAR(100)  NOT NULL,
    phone_number     VARCHAR(20)   NOT NULL,                    -- PRIMARY contact (required for all)
    email            VARCHAR(150)  DEFAULT NULL,                -- Optional for landlords
    password_hash    VARCHAR(255)  NOT NULL,
    role             ENUM('tenant','landlord','admin') NOT NULL DEFAULT 'tenant',
    monthly_salary   DECIMAL(15,2) DEFAULT NULL,               -- For tenants only
    profile_photo    VARCHAR(255)  DEFAULT NULL,
    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
    created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email (email),                               -- NULL-safe: allows multiple NULLs
    UNIQUE KEY uq_phone (phone_number)
);

-- ============================================================
-- TABLE 2: locations
-- Stores Nigerian cities/states for property listings
-- ============================================================
CREATE TABLE locations (
    location_id  INT AUTO_INCREMENT PRIMARY KEY,
    city         VARCHAR(100) NOT NULL,
    state        VARCHAR(100) NOT NULL,
    country      VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO locations (city, state) VALUES
('Lekki',           'Lagos'),
('Victoria Island', 'Lagos'),
('Surulere',        'Lagos'),
('Yaba',            'Lagos'),
('Ikeja',           'Lagos'),
('Maitama',         'Abuja'),
('Wuse',            'Abuja'),
('Gwarinpa',        'Abuja'),
('Kubwa',           'Abuja'),
('Port Harcourt',   'Rivers'),
('Bodija',          'Oyo'),
('Ibadan',          'Oyo'),
('Enugu',           'Enugu'),
('Kano',            'Kano');

-- ============================================================
-- TABLE 3: properties (listings)
-- CHANGE v2: renamed listing_id added as alias
--            bank_account_number explicitly EXCLUDED (anti-fraud)
--            landlord_phone_visible flag added
-- ============================================================
CREATE TABLE properties (
    property_id          INT AUTO_INCREMENT PRIMARY KEY,
    landlord_id          INT           NOT NULL,               -- FK -> users (role = landlord)
    location_id          INT           NOT NULL,
    title                VARCHAR(200)  NOT NULL,
    description          TEXT,
    property_type        ENUM('flat','duplex','bungalow','self_contain',
                              'room_parlour','studio','terraced_house') NOT NULL,
    bedrooms             TINYINT       NOT NULL DEFAULT 1,
    bathrooms            TINYINT       NOT NULL DEFAULT 1,
    size_sqm             DECIMAL(8,2)  DEFAULT NULL,
    monthly_rent         DECIMAL(15,2) NOT NULL,
    full_address         VARCHAR(300)  NOT NULL,               -- Shown to tenant after "Contact Landlord"
    latitude             DECIMAL(10,7) DEFAULT NULL,
    longitude            DECIMAL(10,7) DEFAULT NULL,
    -- Anti-fraud: phone shown only after tenant clicks "Contact Landlord"
    -- bank_account_number is intentionally NOT stored here
    is_available         TINYINT(1)    NOT NULL DEFAULT 1,
    is_approved          TINYINT(1)    NOT NULL DEFAULT 0,     -- Admin must approve before listing goes live
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (landlord_id)  REFERENCES users(user_id)      ON DELETE CASCADE,
    FOREIGN KEY (location_id)  REFERENCES locations(location_id)
);

-- ============================================================
-- TABLE 4: property_images
-- ============================================================
CREATE TABLE property_images (
    image_id     INT AUTO_INCREMENT PRIMARY KEY,
    property_id  INT          NOT NULL,
    image_url    VARCHAR(300) NOT NULL,
    is_cover     TINYINT(1)   NOT NULL DEFAULT 0,
    uploaded_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 5: property_amenities
-- ============================================================
CREATE TABLE property_amenities (
    amenity_id   INT AUTO_INCREMENT PRIMARY KEY,
    property_id  INT          NOT NULL,
    amenity_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 6: saved_properties
-- ============================================================
CREATE TABLE saved_properties (
    saved_id    INT      AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT      NOT NULL,
    property_id INT      NOT NULL,
    saved_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_save (tenant_id, property_id),
    FOREIGN KEY (tenant_id)   REFERENCES users(user_id)            ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(property_id)   ON DELETE CASCADE
);

-- ============================================================
-- TABLE 7: tenancies
-- Records the rental agreement between a tenant and a property
-- ============================================================
CREATE TABLE tenancies (
    tenancy_id   INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id    INT           NOT NULL,
    property_id  INT           NOT NULL,
    landlord_id  INT           NOT NULL,
    start_date   DATE          NOT NULL,
    end_date     DATE          DEFAULT NULL,
    monthly_rent DECIMAL(15,2) NOT NULL,
    status       ENUM('active','expired','terminated') NOT NULL DEFAULT 'active',
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)   REFERENCES users(user_id)          ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
    FOREIGN KEY (landlord_id) REFERENCES users(user_id)          ON DELETE CASCADE
);

-- ============================================================
-- TABLE 8: rent_payments  ← MAJOR CHANGE IN v2
--
-- CHANGE v2:
--   status now has THREE values: pending | confirmed | rejected
--   (previously was: paid | pending | overdue)
--
--   FLOW:
--   1. Tenant pays landlord physically (cash/bank transfer)
--   2. Tenant logs claim in-app  → status = 'pending'
--   3. Landlord logs in → sees claim → marks 'confirmed' or 'rejected'
--   4. Tenant dashboard updates accordingly
--
--   bank_account_number is intentionally NOT stored here (anti-fraud)
--   confirmed_at tracks when landlord verified the payment
-- ============================================================
CREATE TABLE rent_payments (
    payment_id      INT AUTO_INCREMENT PRIMARY KEY,
    tenancy_id      INT           DEFAULT NULL,
    tenant_id       INT           NOT NULL,
    property_id     INT           NOT NULL,
    landlord_id     INT           NOT NULL,                    -- Who needs to confirm
    amount          DECIMAL(15,2) NOT NULL,
    payment_month   VARCHAR(20)   NOT NULL,                    -- e.g. 'July 2026'
    payment_year    YEAR          NOT NULL,
    period_covered  VARCHAR(100)  DEFAULT NULL,                -- e.g. 'July 1 – July 31, 2026'
    due_date        DATE          NOT NULL,
    date_paid       DATE          DEFAULT NULL,                -- Date tenant claims payment was made
    payment_method  ENUM('bank_transfer','cash','pos','cheque') NOT NULL DEFAULT 'bank_transfer',
    reference_no    VARCHAR(100)  DEFAULT NULL,                -- Teller no. or transfer ref from bank
    -- ── LANDLORD CONFIRMATION FIELDS ──
    status          ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
    confirmed_at    DATETIME      DEFAULT NULL,                -- Set when landlord confirms
    rejection_reason VARCHAR(300) DEFAULT NULL,                -- Landlord's reason for rejection
    -- ── METADATA ──
    notes           TEXT          DEFAULT NULL,                -- Tenant notes
    receipt_url     VARCHAR(300)  DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenancy_id)  REFERENCES tenancies(tenancy_id)   ON DELETE SET NULL,
    FOREIGN KEY (tenant_id)   REFERENCES users(user_id)          ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
    FOREIGN KEY (landlord_id) REFERENCES users(user_id)          ON DELETE CASCADE
);

-- ============================================================
-- TABLE 9: payment_confirmations_log
-- NEW in v2: audit trail of landlord confirm/reject actions
-- ============================================================
CREATE TABLE payment_confirmations_log (
    log_id        INT AUTO_INCREMENT PRIMARY KEY,
    payment_id    INT          NOT NULL,
    landlord_id   INT          NOT NULL,
    action        ENUM('confirmed','rejected') NOT NULL,
    reason        VARCHAR(300) DEFAULT NULL,
    actioned_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id)  REFERENCES rent_payments(payment_id) ON DELETE CASCADE,
    FOREIGN KEY (landlord_id) REFERENCES users(user_id)            ON DELETE CASCADE
);

-- ============================================================
-- TABLE 10: payment_reminders
-- ============================================================
CREATE TABLE payment_reminders (
    reminder_id   INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT      NOT NULL,
    tenancy_id    INT      DEFAULT NULL,
    remind_date   DATE     NOT NULL,
    reminder_type ENUM('7_days','3_days','1_day','due_today','overdue') NOT NULL,
    is_sent       TINYINT(1) NOT NULL DEFAULT 0,
    sent_at       DATETIME DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)  REFERENCES users(user_id)          ON DELETE CASCADE,
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id)   ON DELETE SET NULL
);

-- ============================================================
-- TABLE 11: notifications
-- ============================================================
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT         NOT NULL,
    type            ENUM('rent_reminder','payment_confirmed','payment_rejected',
                         'overdue_alert','new_listing','system','lease_expiry') NOT NULL,
    is_read         TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 12: affordability_profiles
-- CHANGE v2: monthly_salary replaces monthly_income
-- ============================================================
CREATE TABLE affordability_profiles (
    profile_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT           NOT NULL UNIQUE,
    monthly_salary      DECIMAL(15,2) NOT NULL,
    max_rent_budget     DECIMAL(15,2) GENERATED ALWAYS AS (monthly_salary * 0.30) STORED,
    preferred_location  VARCHAR(200)  DEFAULT NULL,
    preferred_bedrooms  TINYINT       DEFAULT NULL,
    preferred_type      VARCHAR(100)  DEFAULT NULL,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 13: admin_logs
-- ============================================================
CREATE TABLE admin_logs (
    log_id       INT AUTO_INCREMENT PRIMARY KEY,
    admin_id     INT          NOT NULL,
    action       VARCHAR(200) NOT NULL,
    target_table VARCHAR(100) DEFAULT NULL,
    target_id    INT          DEFAULT NULL,
    details      TEXT         DEFAULT NULL,
    logged_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 14: contact_reveals_log  ← NEW in v2
-- Logs when a tenant clicks "Contact Landlord" on a listing
-- Useful for analytics and fraud monitoring
-- ============================================================
CREATE TABLE contact_reveals_log (
    reveal_id   INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT      NOT NULL,
    property_id INT      NOT NULL,
    revealed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)   REFERENCES users(user_id)          ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_properties_rent      ON properties(monthly_rent);
CREATE INDEX idx_properties_location  ON properties(location_id);
CREATE INDEX idx_properties_available ON properties(is_available, is_approved);
CREATE INDEX idx_payments_tenant      ON rent_payments(tenant_id);
CREATE INDEX idx_payments_landlord    ON rent_payments(landlord_id);
CREATE INDEX idx_payments_status      ON rent_payments(status);
CREATE INDEX idx_payments_due         ON rent_payments(due_date);
CREATE INDEX idx_notif_user           ON notifications(user_id, is_read);
CREATE INDEX idx_users_phone          ON users(phone_number);
CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_role           ON users(role);

-- ============================================================
-- STORED PROCEDURE: Confirm Payment
-- Called when landlord clicks "Confirm" on a payment claim
-- ============================================================
DELIMITER $$

CREATE PROCEDURE confirm_payment(
    IN p_payment_id  INT,
    IN p_landlord_id INT
)
BEGIN
    DECLARE v_tenant_id INT;
    DECLARE v_amount    DECIMAL(15,2);
    DECLARE v_month     VARCHAR(20);

    -- Update payment status
    UPDATE rent_payments
    SET status       = 'confirmed',
        confirmed_at = NOW(),
        updated_at   = NOW()
    WHERE payment_id = p_payment_id
      AND landlord_id = p_landlord_id
      AND status = 'pending';

    -- Get tenant info for notification
    SELECT tenant_id, amount, payment_month
    INTO v_tenant_id, v_amount, v_month
    FROM rent_payments WHERE payment_id = p_payment_id;

    -- Log the action
    INSERT INTO payment_confirmations_log (payment_id, landlord_id, action)
    VALUES (p_payment_id, p_landlord_id, 'confirmed');

    -- Notify tenant
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
        v_tenant_id,
        'Payment Confirmed ✅',
        CONCAT('Your rent payment of ₦', FORMAT(v_amount,0), ' for ', v_month,
               ' has been confirmed by your landlord. Your record is now up to date.'),
        'payment_confirmed'
    );
END$$

-- ============================================================
-- STORED PROCEDURE: Reject Payment
-- Called when landlord clicks "Reject" on a payment claim
-- ============================================================
CREATE PROCEDURE reject_payment(
    IN p_payment_id  INT,
    IN p_landlord_id INT,
    IN p_reason      VARCHAR(300)
)
BEGIN
    DECLARE v_tenant_id INT;
    DECLARE v_amount    DECIMAL(15,2);
    DECLARE v_month     VARCHAR(20);

    -- Update payment status
    UPDATE rent_payments
    SET status           = 'rejected',
        rejection_reason = p_reason,
        updated_at       = NOW()
    WHERE payment_id = p_payment_id
      AND landlord_id = p_landlord_id
      AND status = 'pending';

    -- Get tenant info
    SELECT tenant_id, amount, payment_month
    INTO v_tenant_id, v_amount, v_month
    FROM rent_payments WHERE payment_id = p_payment_id;

    -- Log the action
    INSERT INTO payment_confirmations_log (payment_id, landlord_id, action, reason)
    VALUES (p_payment_id, p_landlord_id, 'rejected', p_reason);

    -- Notify tenant
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
        v_tenant_id,
        'Payment Claim Rejected ⚠️',
        CONCAT('Your payment claim of ₦', FORMAT(v_amount,0), ' for ', v_month,
               ' was rejected by your landlord. Reason: ', IFNULL(p_reason,'No reason given'),
               '. Please contact your landlord directly to resolve this.'),
        'payment_rejected'
    );
END$$

DELIMITER ;

-- ============================================================
-- VIEW: Pending Payment Claims (for landlord dashboard)
-- ============================================================
CREATE OR REPLACE VIEW pending_payment_claims AS
SELECT
    rp.payment_id,
    rp.payment_month,
    rp.amount,
    rp.date_paid,
    rp.payment_method,
    rp.reference_no,
    rp.notes,
    rp.created_at AS submitted_at,
    CONCAT(tu.first_name, ' ', tu.last_name) AS tenant_name,
    tu.phone_number AS tenant_phone,
    p.title        AS property_title,
    p.full_address AS property_address,
    rp.landlord_id
FROM rent_payments rp
JOIN users       tu ON rp.tenant_id   = tu.user_id
JOIN properties  p  ON rp.property_id = p.property_id
WHERE rp.status = 'pending'
ORDER BY rp.created_at DESC;

-- ============================================================
-- END OF SCHEMA v2.0
-- ============================================================
