using Microsoft.AspNetCore.Identity;
using OnMe.Api.Data;
using OnMe.Api.Models;

namespace OnMe.Api.Data;

public static class SeedData
{
    public static async Task EnsureSeededAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();

        var roleMgr = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var r in new[] { "SuperAdmin", "Admin", "Staff" })
            if (!await roleMgr.RoleExistsAsync(r))
                await roleMgr.CreateAsync(new IdentityRole(r));

        var userMgr = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var adminEmail = "superadmin@onme.sa";
        var admin = await userMgr.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                DisplayName = "Super Admin",
                EmailConfirmed = true
            };
            await userMgr.CreateAsync(admin, "Admin123!");
            await userMgr.AddToRoleAsync(admin, "SuperAdmin");
        }

        if (!db.Services.Any())
        {
            db.Services.AddRange(
                new ServiceItem { Title = "بحث ومقارنة", Description = "البحث عن منتج أو مورد أو خدمة أو معلومة، مع المقارنة والتنسيق عند الحاجة.", Icon = "search", SortOrder = 1 },
                new ServiceItem { Title = "تواصل وتنسيق", Description = "التواصل مع الجهات والأشخاص، طرح الاستفسارات وجمع المعلومات وترتيب الخطوات.", Icon = "chat", SortOrder = 2 },
                new ServiceItem { Title = "متابعة وإنجاز", Description = "متابعة موضوع أو إجراء بدأته، وتنسيق المهام التي تحتاج وقتًا أو مراجعة مستمرة.", Icon = "refresh", SortOrder = 3 },
                new ServiceItem { Title = "مهام داخل السعودية أو خارجها", Description = "موضوع يحتاج من يتابع أو ينسق في مدينة أو دولة أخرى، حسب إمكانية التنفيذ.", Icon = "globe", SortOrder = 4 });
        }

        if (!db.ProcessSteps.Any())
        {
            db.ProcessSteps.AddRange(
                new ProcessStep { Title = "أرسل طلبك", Description = "اكتب لنا المهمة بالطريقة التي تعرفها، حتى لو لم تكن متأكدًا من الخطوات.", SortOrder = 1 },
                new ProcessStep { Title = "نراجع ونتولى الممكن", Description = "نراجع التفاصيل، ونبحث ونتواصل وننسق حسب طبيعة الطلب وإمكانية تنفيذه.", SortOrder = 2 },
                new ProcessStep { Title = "نتابع معك", Description = "نوضح لك الخطوات الممكنة ونبقيك على اطلاع حتى تصل المهمة إلى نتيجتها المتاحة.", SortOrder = 3 });
        }

        if (!db.FaqItems.Any())
        {
            db.FaqItems.AddRange(
                new FaqItem { Question = "هل تنفذون أي مهمة؟", Answer = "كل مهمة تختلف. أرسل التفاصيل وسنراجع إمكانية تنفيذها والخطوات المناسبة لها.", SortOrder = 1 },
                new FaqItem { Question = "هل الخدمة داخل السعودية فقط؟", Answer = "يمكن أن تكون المهمة داخل السعودية أو خارجها، حسب طبيعة المهمة وإمكانية تنفيذها.", SortOrder = 2 },
                new FaqItem { Question = "هل يجب أن أعرف طريقة تنفيذ المهمة؟", Answer = "لا. اشرح النتيجة التي تريد الوصول إليها، وسنبحث عن الطريقة المناسبة لما يمكننا توليه.", SortOrder = 3 },
                new FaqItem { Question = "كم تستغرق المهمة؟", Answer = "تختلف المدة حسب طبيعة المهمة والجهات المطلوبة. نوضح الخطوات والمدة المتوقعة بعد مراجعة الطلب.", SortOrder = 4 });
        }

        if (!db.TaskExamples.Any())
        {
            db.TaskExamples.AddRange(
                new TaskExample { Text = "أحتاج ألقى موردًا في دولة أخرى لمنتج معين.", SortOrder = 1 },
                new TaskExample { Text = "أريد أحدًا يتواصل مع عدة جهات ويجمع لي المعلومات.", SortOrder = 2 },
                new TaskExample { Text = "عندي موضوع يحتاج متابعة في مدينة أخرى.", SortOrder = 3 },
                new TaskExample { Text = "أحتاج البحث والمقارنة والترتيب قبل اتخاذ قرار.", SortOrder = 4 });
        }

        if (!db.PageSections.Any())
        {
            db.PageSections.AddRange(
                new PageSection { Key = "hero", Title = "عندك مهمة؟ خلّها علينا.", Body = "مو كل شيء يستحق من وقتك. أرسل لنا اللي تحتاجه، ونبحث عن الطريقة المناسبة للبحث والتواصل والتنسيق والمتابعة حتى نوصلك للنتيجة الممكنة.", CtaText = "خلّها علينا", CtaUrl = "#lead-form", SortOrder = 1 },
                new PageSection { Key = "about", Title = "مو لازم تسوي كل شيء بنفسك.", Body = "اشرح لنا المطلوب، ونحن نراجع المهمة ونبحث عن الطريقة المناسبة لتنفيذ ما يمكننا توليه عنك. أنت تحدد النتيجة، ونحن نبحث عن الطريق إليها.", SortOrder = 2 },
                new PageSection { Key = "form", Title = "خلّها علينا.", Body = "اشرح لنا المهمة، والباقي نبدأ فيه معك.", CtaText = "أرسل طلبي", CtaUrl = "/api/leads", SortOrder = 3 });
        }

        var defaults = new Dictionary<string, string>
        {
            ["brand_name"] = "OnMe",
            ["brand_tagline"] = "خلّها علينا",
            ["phone"] = "0533851110",
            ["footer_text"] = "OnMe — خلّها علينا.",
            ["copyright"] = "© 2026 OnMe. All rights reserved.",
            ["seo_title"] = "OnMe | خلّها علينا — وكيلك الشخصي لإنجاز مهامك",
            ["seo_description"] = "عندك مهمة ما عندك وقت لها؟ أرسلها إلى OnMe، وخلّنا نراجع البحث والتواصل والتنسيق والمتابعة عنك."
        };
        foreach (var (k, v) in defaults)
            if (!db.SiteSettings.Any(s => s.Key == k))
                db.SiteSettings.Add(new SiteSetting { Key = k, Value = v });

        await db.SaveChangesAsync();
    }
}
