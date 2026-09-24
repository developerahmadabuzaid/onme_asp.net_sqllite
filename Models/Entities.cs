using System.ComponentModel.DataAnnotations;

namespace OnMe.Api.Models;

// حالات الطلب حسب المواصفة §16.5
public static class LeadStatuses
{
    public const string New = "New";
    public const string Contacted = "Contacted";
    public const string Reviewing = "Reviewing";
    public const string Quoted = "Quoted";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All =
        [New, Contacted, Reviewing, Quoted, InProgress, Completed, Cancelled];
}

public class Lead
{
    public int Id { get; set; }

    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    // inside_saudi | outside_saudi | unsure | null
    [MaxLength(20)]
    public string? Location { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = LeadStatuses.New;

    [MaxLength(450)]
    public string? AssignedToUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public string RefCode { get; set; } = string.Empty;

    public List<LeadNote> Notes { get; set; } = [];
}

public class LeadNote
{
    public int Id { get; set; }
    public int LeadId { get; set; }
    public Lead? Lead { get; set; }

    public string Body { get; set; } = string.Empty;

    [MaxLength(450)]
    public string? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class LeadAssignment
{
    public int Id { get; set; }
    public int LeadId { get; set; }

    [MaxLength(450)]
    public string AssignedToUserId { get; set; } = string.Empty;

    [MaxLength(450)]
    public string? AssignedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PageSection
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string Key { get; set; } = string.Empty; // hero, about, form...

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Body { get; set; }

    [MaxLength(120)]
    public string? CtaText { get; set; }

    [MaxLength(300)]
    public string? CtaUrl { get; set; }

    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
}

public class ServiceItem
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    [MaxLength(80)]
    public string? Icon { get; set; }

    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
}

public class ProcessStep
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
}

public class FaqItem
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
}

public class TaskExample
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
}

public class MediaFile
{
    public int Id { get; set; }

    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Url { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    [MaxLength(50)]
    public string Kind { get; set; } = "image"; // image | video | logo

    [MaxLength(300)]
    public string? AltText { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SiteSetting
{
    [Key]
    [MaxLength(80)]
    public string Key { get; set; } = string.Empty;

    public string? Value { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public int Id { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    [MaxLength(120)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Entity { get; set; }

    [MaxLength(80)]
    public string? EntityId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
