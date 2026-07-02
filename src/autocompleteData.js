// Curated suggestion lists wired to <datalist> elements for autocomplete on
// free-text fields. These are just hints — fields stay plain text inputs, so
// typing anything not on the list works fine.

export const JOB_TITLE_SUGGESTIONS = [
  'Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Frontend Developer',
  'Backend Developer', 'Full Stack Developer', 'DevOps Engineer', 'Site Reliability Engineer',
  'Data Scientist', 'Data Analyst', 'Data Engineer', 'Machine Learning Engineer', 'Product Manager',
  'Project Manager', 'Engineering Manager', 'QA Engineer', 'UX Designer', 'UI Designer',
  'Technical Lead', 'Solutions Architect', 'Systems Administrator', 'Business Analyst',
  'Marketing Manager', 'Sales Manager', 'Account Manager', 'Customer Success Manager', 'Intern',
];

// Language proficiency: the common word scale plus the CEFR levels that
// European applications expect. Free-text, so anything else works too.
export const PROFICIENCY_SUGGESTIONS = [
  'Native', 'Fluent', 'Professional', 'Conversational', 'Basic',
  'C2', 'C1', 'B2', 'B1', 'A2', 'A1',
];

export const DEGREE_SUGGESTIONS = [
  'BSc Computer Science', 'BSc Software Engineering', 'BSc Information Technology',
  'BSc Data Science', 'BA Business Administration', 'BEng Electrical Engineering',
  'BEng Mechanical Engineering', 'MSc Computer Science', 'MSc Data Science', 'MBA', 'MEng',
  'PhD Computer Science', 'Associate Degree in Computer Science', 'High School Diploma',
];
