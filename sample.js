/* Sample files so the library can be tried without uploading anything.
   The files are generated in the browser: text notes, an SVG diagram and small PDFs. */

// Builds a one-page PDF with lines of text (ASCII only, Helvetica)
function makePdf(title, lines) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let text = `BT /F1 20 Tf 60 780 Td (${esc(title)}) Tj ET\n`;
  lines.forEach((line, i) => {
    text += `BT /F1 12 Tf 60 ${740 - i * 22} Td (${esc(line)}) Tj ET\n`;
  });
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

const ER_DIAGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" font-family="Segoe UI, sans-serif">
  <rect width="640" height="360" fill="#f8fafc"/>
  <text x="320" y="36" text-anchor="middle" font-size="20" font-weight="700" fill="#1e293b">ER Diagram: College Database</text>
  <g fill="#e0e7ff" stroke="#4f46e5" stroke-width="2">
    <rect x="40" y="140" width="140" height="60" rx="6"/>
    <rect x="460" y="140" width="140" height="60" rx="6"/>
    <polygon points="320,120 390,170 320,220 250,170" fill="#fef3c7" stroke="#d97706"/>
  </g>
  <g font-size="16" text-anchor="middle" fill="#1e293b">
    <text x="110" y="176">STUDENT</text>
    <text x="530" y="176">COURSE</text>
    <text x="320" y="176">ENROLS</text>
  </g>
  <g stroke="#475569" stroke-width="2"><line x1="180" y1="170" x2="250" y2="170"/><line x1="390" y1="170" x2="460" y2="170"/></g>
  <g font-size="13" fill="#475569" text-anchor="middle"><text x="215" y="160">M</text><text x="425" y="160">N</text></g>
  <g fill="#ecfdf5" stroke="#059669" stroke-width="1.5">
    <ellipse cx="70" cy="270" rx="50" ry="22"/><ellipse cx="170" cy="270" rx="50" ry="22"/>
    <ellipse cx="480" cy="270" rx="50" ry="22"/><ellipse cx="580" cy="270" rx="46" ry="22"/>
  </g>
  <g font-size="13" text-anchor="middle" fill="#065f46">
    <text x="70" y="275" text-decoration="underline">roll_no</text><text x="170" y="275">name</text>
    <text x="480" y="275" text-decoration="underline">course_id</text><text x="580" y="275">credits</text>
  </g>
  <g stroke="#94a3b8"><line x1="80" y1="200" x2="72" y2="248"/><line x1="140" y1="200" x2="165" y2="248"/><line x1="500" y1="200" x2="482" y2="248"/><line x1="560" y1="200" x2="578" y2="248"/></g>
</svg>`;

function getSampleFiles() {
  const day = 86400000;
  const now = Date.now();
  const txt = s => new Blob([s], { type: 'text/plain' });
  return [
    {
      title: 'Unit 3: Normalization (1NF to BCNF)',
      subject: 'DBMS', semester: 4, type: 'notes', author: 'Ananya',
      tags: ['unit 3', 'normalization', 'important'],
      description: 'Short notes with examples for every normal form, plus a quick checklist for exams.',
      fileName: 'dbms-unit3-normalization.txt', daysAgo: 2,
      blob: txt(`DBMS - UNIT 3: NORMALIZATION\n============================\n\nWhy normalize?\n- Remove redundancy (same data stored many times)\n- Avoid insert, update and delete anomalies\n\n1NF: Every cell holds one atomic value. No repeating groups.\n2NF: In 1NF + no partial dependency (non-key column depends on part of a composite key).\n3NF: In 2NF + no transitive dependency (A -> B -> C where A is the key).\nBCNF: For every functional dependency X -> Y, X must be a super key.\n\nExam checklist\n1. Find all functional dependencies.\n2. Find the candidate keys (closure of attributes).\n3. Check each normal form in order.\n4. Decompose, and check it is lossless and dependency preserving.\n`)
    },
    {
      title: 'ER Diagram: College database',
      subject: 'DBMS', semester: 4, type: 'materials', author: 'Ananya',
      tags: ['er diagram', 'unit 1'],
      description: 'Clean ER diagram showing a many to many relationship between students and courses.',
      fileName: 'er-diagram-college.svg', daysAgo: 5,
      blob: new Blob([ER_DIAGRAM_SVG], { type: 'image/svg+xml' })
    },
    {
      title: 'Data Structures: Mid-term paper 2024',
      subject: 'Data Structures', semester: 3, type: 'papers', author: 'Rahul',
      tags: ['2024', 'mid-term'],
      description: 'Previous mid-term question paper. 5 questions, 50 marks.',
      fileName: 'ds-midterm-2024.pdf', daysAgo: 9,
      blob: makePdf('Data Structures - Mid-term 2024', [
        'Time: 90 minutes                                   Max marks: 50',
        '',
        '1. Write an algorithm to reverse a singly linked list. (10)',
        '2. Convert the infix expression A+B*(C-D)/E to postfix using a stack. (10)',
        '3. Explain circular queue with insert and delete operations. (10)',
        '4. Build a binary search tree for: 45, 20, 60, 10, 30, 55, 70. (10)',
        '   Show inorder, preorder and postorder traversals.',
        '5. Compare bubble sort, insertion sort and quick sort. (10)'
      ])
    },
    {
      title: 'Operating Systems: End semester paper 2023',
      subject: 'Operating Systems', semester: 4, type: 'papers', author: 'Priya',
      tags: ['2023', 'end sem'],
      description: 'End semester question paper with CPU scheduling and deadlock questions.',
      fileName: 'os-endsem-2023.pdf', daysAgo: 20,
      blob: makePdf('Operating Systems - End Semester 2023', [
        'Answer any FIVE questions. Each question carries 14 marks.',
        '',
        '1. Explain process states with a neat diagram.',
        '2. Solve FCFS, SJF and Round Robin (q = 2) for the given processes.',
        '3. State the four necessary conditions for deadlock.',
        '4. Explain the Banker\'s algorithm with an example.',
        '5. Compare paging and segmentation.',
        '6. Explain FIFO, LRU and Optimal page replacement.',
        '7. Write short notes on semaphores and monitors.'
      ])
    },
    {
      title: 'Lab 5: Stack using arrays (C program)',
      subject: 'Data Structures', semester: 3, type: 'lab', author: 'Rahul',
      tags: ['lab 5', 'stack', 'c'],
      description: 'Lab record with aim, algorithm, program and output for stack operations.',
      fileName: 'ds-lab5-stack.txt', daysAgo: 12,
      blob: txt(`LAB 5: IMPLEMENTATION OF STACK USING ARRAYS\n\nAim: To implement push, pop and display operations on a stack.\n\nProgram:\n#include <stdio.h>\n#define MAX 5\nint stack[MAX], top = -1;\n\nvoid push(int x) {\n  if (top == MAX - 1) { printf("Stack overflow\\n"); return; }\n  stack[++top] = x;\n}\n\nint pop() {\n  if (top == -1) { printf("Stack underflow\\n"); return -1; }\n  return stack[top--];\n}\n\nint main() {\n  push(10); push(20); push(30);\n  printf("Popped: %d\\n", pop());\n  for (int i = top; i >= 0; i--) printf("%d ", stack[i]);\n  return 0;\n}\n\nOutput:\nPopped: 30\n20 10\n\nResult: The stack operations were executed successfully.\n`)
    },
    {
      title: 'Engineering Maths: Formula sheet',
      subject: 'Mathematics', semester: 1, type: 'materials', author: 'Kiran',
      tags: ['formulas', 'quick revision'],
      description: 'Every formula from differentiation, integration and matrices on one page.',
      fileName: 'maths-formula-sheet.pdf', daysAgo: 30,
      blob: makePdf('Engineering Mathematics - Formula Sheet', [
        'd/dx (x^n) = n x^(n-1)          d/dx (sin x) = cos x',
        'd/dx (e^x) = e^x                d/dx (ln x) = 1/x',
        'Integral x^n dx = x^(n+1)/(n+1) + C',
        'Integral of 1/x dx = ln|x| + C',
        'Product rule: (uv)\' = u\'v + uv\'',
        'Matrix: A * inverse(A) = I,  det(AB) = det(A) det(B)',
        'Eigen values: solve det(A - kI) = 0',
        'Taylor series: f(x) = f(a) + f\'(a)(x-a) + f\'\'(a)(x-a)^2/2! + ...'
      ])
    },
    {
      title: 'Computer Networks: OSI model notes',
      subject: 'Computer Networks', semester: 5, type: 'notes', author: 'Priya',
      tags: ['unit 1', 'osi', 'tcp/ip'],
      description: 'All seven layers with their job, protocols and devices in a simple table.',
      fileName: 'cn-osi-model.txt', daysAgo: 1,
      blob: txt(`OSI MODEL (top to bottom)\n\n7 Application   - services to the user        - HTTP, FTP, SMTP, DNS\n6 Presentation  - encryption, compression     - SSL/TLS, JPEG\n5 Session       - open and close sessions     - RPC, NetBIOS\n4 Transport     - end to end delivery         - TCP, UDP\n3 Network       - routing and IP addresses    - IP, ICMP   (router)\n2 Data link     - frames and MAC addresses    - Ethernet   (switch)\n1 Physical      - bits on the wire            - cables     (hub)\n\nMemory trick: "All People Seem To Need Data Processing"\n`)
    }
  ].map(s => ({ ...s, createdAt: now - s.daysAgo * day }));
}
