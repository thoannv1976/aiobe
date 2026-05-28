import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  const exists = await prisma.program.findUnique({
    where: { code: "CNTT2024" },
  });
  if (exists) {
    console.log("Đã có dữ liệu mẫu — bỏ qua.");
    return;
  }

  const program = await prisma.program.create({
    data: {
      code: "CNTT2024",
      name: "Cử nhân Công nghệ thông tin",
      level: "Cử nhân",
      major: "Công nghệ thông tin",
      year: 2024,
      goals:
        "Đào tạo cử nhân CNTT có kiến thức nền tảng, kỹ năng lập trình, phân tích hệ thống, phát triển phần mềm và làm việc nhóm, đáp ứng nhu cầu nhân lực CNTT.",
      plos: {
        create: [
          {
            code: "PLO1",
            description:
              "Vận dụng kiến thức toán học, khoa học cơ bản và CNTT để giải quyết các vấn đề chuyên môn.",
            category: "Kiến thức",
            bloomLevel: "Apply",
            pis: {
              create: [
                {
                  code: "PI1.1",
                  description: "Áp dụng kiến thức toán rời rạc, cấu trúc dữ liệu.",
                },
                {
                  code: "PI1.2",
                  description: "Vận dụng nguyên lý hệ điều hành, mạng máy tính.",
                },
              ],
            },
          },
          {
            code: "PLO2",
            description:
              "Thiết kế và phát triển hệ thống phần mềm đáp ứng yêu cầu thực tiễn.",
            category: "Kỹ năng",
            bloomLevel: "Create",
            pis: {
              create: [
                {
                  code: "PI2.1",
                  description: "Phân tích yêu cầu, thiết kế kiến trúc hệ thống.",
                },
                {
                  code: "PI2.2",
                  description: "Cài đặt, kiểm thử và triển khai phần mềm.",
                },
              ],
            },
          },
          {
            code: "PLO3",
            description:
              "Làm việc nhóm hiệu quả, giao tiếp chuyên nghiệp trong môi trường đa văn hóa.",
            category: "Kỹ năng",
            bloomLevel: "Apply",
          },
          {
            code: "PLO4",
            description:
              "Thể hiện đạo đức nghề nghiệp, ý thức học tập suốt đời và trách nhiệm xã hội.",
            category: "Thái độ",
            bloomLevel: "Evaluate",
          },
        ],
      },
      courses: {
        create: [
          { code: "CNTT101", name: "Nhập môn lập trình", credits: 3, semester: 1, type: "Đại cương" },
          { code: "CNTT102", name: "Cấu trúc dữ liệu & Giải thuật", credits: 4, semester: 2, type: "Cơ sở ngành" },
          { code: "CNTT201", name: "Cơ sở dữ liệu", credits: 3, semester: 3, type: "Cơ sở ngành" },
          { code: "CNTT202", name: "Lập trình hướng đối tượng", credits: 3, semester: 3, type: "Cơ sở ngành" },
          { code: "CNTT301", name: "Công nghệ phần mềm", credits: 3, semester: 4, type: "Chuyên ngành" },
          { code: "CNTT302", name: "Mạng máy tính", credits: 3, semester: 4, type: "Chuyên ngành" },
          { code: "CNTT401", name: "Trí tuệ nhân tạo", credits: 3, semester: 5, type: "Chuyên ngành" },
          { code: "CNTT402", name: "An toàn thông tin", credits: 3, semester: 6, type: "Tự chọn" },
        ],
      },
    },
    include: { plos: true, courses: true },
  });

  const course = program.courses.find((c) => c.code === "CNTT101")!;
  const syllabus = await prisma.syllabus.create({
    data: {
      courseId: course.id,
      version: "1.0",
      status: "APPROVED",
      objective:
        "Trang bị kiến thức nhập môn lập trình, tư duy thuật toán cơ bản, kỹ năng viết chương trình bằng ngôn ngữ C/Python.",
      description:
        "Học phần giới thiệu các khái niệm lập trình cơ bản: biến, kiểu dữ liệu, cấu trúc điều khiển, hàm, mảng và file.",
      teachingMethod:
        "Thuyết giảng kết hợp thực hành phòng máy, làm bài tập theo nhóm.",
      assessmentPlan: JSON.stringify([
        { name: "Chuyên cần", type: "Quá trình", weight: 10, cloRefs: "" },
        { name: "Thực hành", type: "Quá trình", weight: 20, cloRefs: "CLO2,CLO3" },
        { name: "Giữa kỳ", type: "MIDTERM", weight: 20, cloRefs: "CLO1,CLO2" },
        { name: "Cuối kỳ", type: "FINAL", weight: 50, cloRefs: "CLO1,CLO2,CLO3" },
      ]),
      clos: {
        create: [
          {
            code: "CLO1",
            description: "Hiểu được các khái niệm cơ bản về lập trình.",
            category: "Kiến thức",
            bloomLevel: "Understand",
          },
          {
            code: "CLO2",
            description: "Vận dụng cấu trúc điều khiển và hàm để giải bài toán.",
            category: "Kỹ năng",
            bloomLevel: "Apply",
          },
          {
            code: "CLO3",
            description:
              "Phối hợp nhóm để xây dựng chương trình đơn giản, trình bày kết quả.",
            category: "Kỹ năng",
            bloomLevel: "Apply",
          },
        ],
      },
    },
    include: { clos: true },
  });

  const plo1 = program.plos.find((p) => p.code === "PLO1")!;
  const plo2 = program.plos.find((p) => p.code === "PLO2")!;
  const plo3 = program.plos.find((p) => p.code === "PLO3")!;

  await prisma.cLOPLOMap.createMany({
    data: [
      { cloId: syllabus.clos[0].id, ploId: plo1.id, contribution: "I" },
      { cloId: syllabus.clos[1].id, ploId: plo1.id, contribution: "R" },
      { cloId: syllabus.clos[1].id, ploId: plo2.id, contribution: "I" },
      { cloId: syllabus.clos[2].id, ploId: plo3.id, contribution: "I" },
    ],
  });

  await prisma.textbook.createMany({
    data: [
      {
        courseId: course.id,
        type: "MAIN",
        title: "Cẩm nang lập trình C cơ bản",
        author: "Nguyễn Văn A",
        publisher: "NXB Bách Khoa",
        year: 2022,
      },
      {
        courseId: course.id,
        type: "REFERENCE",
        title: "Python Crash Course",
        author: "Eric Matthes",
        publisher: "No Starch Press",
        year: 2019,
      },
    ],
  });

  await prisma.question.createMany({
    data: [
      {
        courseId: course.id,
        cloId: syllabus.clos[0].id,
        type: "MC",
        difficulty: "EASY",
        bloomLevel: "Remember",
        content: "Biến trong ngôn ngữ C được khai báo bằng từ khóa nào?",
        options: JSON.stringify(["int", "let", "var", "dim"]),
        answer: "A",
      },
      {
        courseId: course.id,
        cloId: syllabus.clos[0].id,
        type: "MC",
        difficulty: "EASY",
        bloomLevel: "Understand",
        content: "Cấu trúc lặp nào kiểm tra điều kiện ở cuối khối lệnh?",
        options: JSON.stringify(["for", "while", "do...while", "if"]),
        answer: "C",
      },
      {
        courseId: course.id,
        cloId: syllabus.clos[1].id,
        type: "SHORT",
        difficulty: "MEDIUM",
        bloomLevel: "Apply",
        content: "Viết hàm tính giai thừa của n bằng cách đệ quy.",
        answer: "int fact(int n){ return n<=1?1:n*fact(n-1); }",
      },
      {
        courseId: course.id,
        cloId: syllabus.clos[1].id,
        type: "ESSAY",
        difficulty: "HARD",
        bloomLevel: "Analyze",
        content:
          "Phân tích độ phức tạp của thuật toán sắp xếp nổi bọt (Bubble Sort) trong trường hợp xấu nhất và tốt nhất.",
        answer:
          "Trường hợp xấu nhất O(n²), tốt nhất O(n) khi mảng đã được sắp xếp.",
      },
      {
        courseId: course.id,
        cloId: syllabus.clos[2].id,
        type: "ESSAY",
        difficulty: "MEDIUM",
        bloomLevel: "Apply",
        content:
          "Thiết kế chương trình quản lý sinh viên đơn giản (thêm/sửa/xóa/tìm) bằng C.",
        answer: "Sử dụng struct + mảng, xử lý nhập/xuất.",
      },
    ],
  });

  console.log("✅ Seeded program:", program.code);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
