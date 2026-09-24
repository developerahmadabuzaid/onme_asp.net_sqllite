using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OnMe.Api.Models;

namespace OnMe.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadNote> LeadNotes => Set<LeadNote>();
    public DbSet<LeadAssignment> LeadAssignments => Set<LeadAssignment>();
    public DbSet<PageSection> PageSections => Set<PageSection>();
    public DbSet<ServiceItem> Services => Set<ServiceItem>();
    public DbSet<ProcessStep> ProcessSteps => Set<ProcessStep>();
    public DbSet<FaqItem> FaqItems => Set<FaqItem>();
    public DbSet<TaskExample> TaskExamples => Set<TaskExample>();
    public DbSet<MediaFile> MediaFiles => Set<MediaFile>();
    public DbSet<SiteSetting> SiteSettings => Set<SiteSetting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<Lead>(e =>
        {
            e.HasIndex(x => x.RefCode).IsUnique();
            e.HasIndex(x => x.Phone);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAt);
            e.Property(x => x.Description).HasColumnType("text");
        });
        b.Entity<LeadNote>(e =>
        {
            e.HasOne(x => x.Lead).WithMany(x => x.Notes)
                .HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Body).HasColumnType("text");
        });
        b.Entity<PageSection>(e => e.HasIndex(x => x.Key).IsUnique());
        b.Entity<SiteSetting>(e => e.HasKey(x => x.Key));
    }
}
