CREATE DATABASE IF NOT EXISTS doc_request_db;
USE doc_request_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_no VARCHAR(30) UNIQUE NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','staff') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_no VARCHAR(30) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  document_type_id INT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  copies INT NOT NULL DEFAULT 1,
  status ENUM('Pending','Processing','Ready for Release','Completed') NOT NULL DEFAULT 'Pending',
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (document_type_id) REFERENCES document_types(id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  status ENUM('Pending','Processing','Ready for Release','Completed') NOT NULL,
  remarks VARCHAR(255) NULL,
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

INSERT IGNORE INTO document_types (name, description) VALUES
 ('Certificate of Enrollment', 'Proof that you are currently enrolled'),
 ('Certificate of Good Moral Character', 'Issued by the guidance office'),
 ('Transcript of Records', 'Official record of grades'),
 ('Certificate of Grades', 'Grades for a specific semester'),
 ('Honorable Dismissal', 'For students transferring to another school'),
 ('Diploma Copy', 'Certified copy of your diploma');
