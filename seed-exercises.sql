-- Claude House: starter question set
-- Run AFTER schema.sql, in the Supabase SQL Editor.
-- 9 questions per subject (3 easy, 3 medium, 3 hard) across 7 subjects.
--
-- Typed answers are compared after trim + lowercase + collapsed spaces,
-- so casing does not matter. Anything needing an accent or exact
-- punctuation is written as multiple choice instead.

delete from public.exercises;

insert into public.exercises (subject, difficulty_tier, type, question, answer, options) values

-- ================= MATH =================
('math', 'easy', 'mc', 'What is 7 + 8?', '15', ARRAY['13', '15', '16', '17']),
('math', 'easy', 'typed', 'What is 12 x 3?', '36', null),
('math', 'easy', 'mc', 'Which number is larger?', '0.7', ARRAY['0.7', '0.65', '0.07', '0.559']),
('math', 'medium', 'typed', 'Solve for x: 3x + 5 = 20', '5', null),
('math', 'medium', 'mc', 'A rectangle is 7 cm by 4 cm. What is its area in cm2?', '28', ARRAY['11', '22', '28', '14']),
('math', 'medium', 'typed', 'What is 25% of 80?', '20', null),
('math', 'hard', 'typed', 'Solve x^2 - 5x + 6 = 0. Give the smaller root.', '2', null),
('math', 'hard', 'typed', 'What is the slope of the line through (1, 2) and (3, 8)?', '3', null),
('math', 'hard', 'mc', 'What is 2^10?', '1024', ARRAY['512', '1000', '1024', '2048']),

-- ================= SCIENCE =================
('science', 'easy', 'typed', 'What is the chemical formula for water?', 'h2o', null),
('science', 'easy', 'mc', 'Which planet is closest to the Sun?', 'Mercury', ARRAY['Venus', 'Mercury', 'Earth', 'Mars']),
('science', 'easy', 'mc', 'Which gas do plants take in for photosynthesis?', 'Carbon dioxide', ARRAY['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen']),
('science', 'medium', 'typed', 'Which organelle is called the powerhouse of the cell?', 'mitochondria', null),
('science', 'medium', 'mc', 'How many chromosomes are in a normal human body cell?', '46', ARRAY['23', '44', '46', '48']),
('science', 'medium', 'mc', 'What state of matter has a fixed volume but no fixed shape?', 'Liquid', ARRAY['Solid', 'Liquid', 'Gas', 'Plasma']),
('science', 'hard', 'mc', 'What is the approximate speed of light in a vacuum?', '3.0 x 10^8 m/s', ARRAY['3.0 x 10^6 m/s', '3.0 x 10^8 m/s', '3.0 x 10^10 m/s', '3.0 x 10^5 m/s']),
('science', 'hard', 'mc', 'Which equation states Newton''s second law?', 'F = ma', ARRAY['E = mc^2', 'F = ma', 'v = d/t', 'P = IV']),
('science', 'hard', 'typed', 'What is the pH of a neutral solution at 25 C?', '7', null),

-- ================= ENGLISH =================
('english', 'easy', 'typed', 'What is the plural of "child"?', 'children', null),
('english', 'easy', 'mc', 'Which word is a verb?', 'run', ARRAY['quickly', 'run', 'blue', 'table']),
('english', 'easy', 'typed', 'What is the past tense of "go"?', 'went', null),
('english', 'medium', 'mc', 'Choose the correct form: "She ___ to school every day."', 'goes', ARRAY['go', 'goes', 'going', 'gone']),
('english', 'medium', 'mc', 'Which word is a synonym for "happy"?', 'joyful', ARRAY['sad', 'joyful', 'angry', 'tired']),
('english', 'medium', 'mc', 'Which sentence is written correctly?', 'They''re going to the park.', ARRAY['Their going to the park.', 'There going to the park.', 'They''re going to the park.', 'Theyre going to the park.']),
('english', 'hard', 'mc', 'Which device is used in "The wind whispered through the trees"?', 'Personification', ARRAY['Simile', 'Metaphor', 'Personification', 'Hyperbole']),
('english', 'hard', 'mc', 'Choose the correct form: "If I ___ you, I would apologise."', 'were', ARRAY['was', 'were', 'am', 'be']),
('english', 'hard', 'mc', 'Which sentence uses the semicolon correctly?', 'It rained all day; the match was cancelled.', ARRAY['It rained all day; and the match was cancelled.', 'It rained all day; the match was cancelled.', 'It rained; all day the match was cancelled.', 'It rained all day; because the match was cancelled.']),

-- ================= CODING =================
('coding', 'easy', 'typed', 'A loop counts from 1 to 5 and stops. How many times does the body run?', '5', null),
('coding', 'easy', 'mc', 'What is a variable used for?', 'Storing a value', ARRAY['Storing a value', 'Printing text', 'Deleting a file', 'Changing the colour']),
('coding', 'easy', 'typed', 'Sort [3, 1, 4] from smallest to largest. What is the first number?', '1', null),
('coding', 'medium', 'typed', 'In Python, what does len("hello") return?', '5', null),
('coding', 'medium', 'mc', 'In Python, what is the first value printed by: for i in range(3): print(i)', '0', ARRAY['0', '1', '2', '3']),
('coding', 'medium', 'typed', 'In JavaScript, what does typeof 42 return?', 'number', null),
('coding', 'hard', 'typed', 'In Python, what does [1, 2, 3][-1] return?', '3', null),
('coding', 'hard', 'mc', 'In JavaScript, what is the result of 0 == "0"?', 'true', ARRAY['true', 'false', 'NaN', 'undefined']),
('coding', 'hard', 'mc', 'What is the time complexity of binary search on a sorted array?', 'O(log n)', ARRAY['O(n)', 'O(log n)', 'O(n^2)', 'O(1)']),

-- ================= SPANISH =================
('spanish', 'easy', 'typed', 'What does "hola" mean in English?', 'hello', null),
('spanish', 'easy', 'mc', 'What is the Spanish word for "cat"?', 'gato', ARRAY['perro', 'gato', 'casa', 'libro']),
('spanish', 'easy', 'typed', 'What does "gracias" mean in English? (two words)', 'thank you', null),
('spanish', 'medium', 'mc', 'Which form means "I eat"?', 'como', ARRAY['como', 'comes', 'come', 'comemos']),
('spanish', 'medium', 'mc', 'What gender is the noun "mesa"?', 'Feminine', ARRAY['Masculine', 'Feminine']),
('spanish', 'medium', 'typed', 'What is the Spanish word for "yesterday"?', 'ayer', null),
('spanish', 'hard', 'mc', 'Which is the preterite "yo" form of "hablar"?', 'hable (with accent on the e)', ARRAY['hablo', 'hable (with accent on the e)', 'hablaba', 'hablare (with accent on the e)']),
('spanish', 'hard', 'mc', 'Which form is the present subjunctive of "hablar" for "yo"?', 'hable', ARRAY['hablo', 'hable', 'hablaba', 'hablo (with accent on the o)']),
('spanish', 'hard', 'mc', 'The phrase "Ojala que..." is followed by which mood?', 'Subjunctive', ARRAY['Indicative', 'Subjunctive', 'Imperative', 'Conditional']),

-- ================= GERMAN =================
('german', 'easy', 'typed', 'What does "Hallo" mean in English?', 'hello', null),
('german', 'easy', 'mc', 'What is the German word for "dog"?', 'Hund', ARRAY['Katze', 'Hund', 'Haus', 'Buch']),
('german', 'easy', 'typed', 'What does "danke" mean in English? (two words)', 'thank you', null),
('german', 'medium', 'mc', 'Which is correct for "I am"?', 'ich bin', ARRAY['ich bin', 'ich bist', 'ich ist', 'ich sind']),
('german', 'medium', 'mc', 'Which article goes with "Maedchen" (Madchen)?', 'das', ARRAY['der', 'die', 'das']),
('german', 'medium', 'typed', 'What is the German word for "tomorrow"?', 'morgen', null),
('german', 'hard', 'mc', 'Which case follows the preposition "mit"?', 'Dative', ARRAY['Nominative', 'Accusative', 'Dative', 'Genitive']),
('german', 'hard', 'typed', 'What is the past participle of "gehen"?', 'gegangen', null),
('german', 'hard', 'mc', 'In a subordinate clause introduced by "weil", where does the conjugated verb go?', 'At the end of the clause', ARRAY['In second position', 'First position', 'At the end of the clause', 'Directly after the subject']),

-- ================= FRENCH =================
('french', 'easy', 'typed', 'What does "bonjour" mean in English?', 'hello', null),
('french', 'easy', 'mc', 'What is the French word for "cat"?', 'chat', ARRAY['chien', 'chat', 'maison', 'livre']),
('french', 'easy', 'typed', 'What does "merci" mean in English? (two words)', 'thank you', null),
('french', 'medium', 'mc', 'Which is correct for "I am"?', 'je suis', ARRAY['je suis', 'tu es', 'il est', 'nous sommes']),
('french', 'medium', 'mc', 'What gender is the noun "table"?', 'Feminine', ARRAY['Masculine', 'Feminine']),
('french', 'medium', 'typed', 'What is the French word for "tomorrow"?', 'demain', null),
('french', 'hard', 'mc', 'Which auxiliary verb does "aller" take in the passe compose?', 'etre', ARRAY['avoir', 'etre']),
('french', 'hard', 'mc', 'What is the passe compose of "aller" for "je" (masculine)?', 'je suis alle', ARRAY['j''ai alle', 'je suis alle', 'je suis avoir alle', 'j''etais alle']),
('french', 'hard', 'mc', 'What is the present subjunctive of "etre" after "que je"?', 'sois', ARRAY['suis', 'sois', 'etais', 'serai']);
