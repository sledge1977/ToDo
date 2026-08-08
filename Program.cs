using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var connectionString =
    builder.Configuration.GetConnectionString("Postgres")
    ?? builder.Configuration["DATABASE_URL"]
    ?? "Host=localhost;Port=5432;Database=todo;Username=todo;Password=todo";

builder.Services.AddDbContext<ToDoDbContext>(options => options.UseNpgsql(connectionString));

// Explicit schemes ensure that SignInManager and the API use the same cookie.
builder
    .Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
        options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
        options.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
    })
    .AddCookie(
        IdentityConstants.ApplicationScheme,
        options =>
        {
            options.LoginPath = "/";
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
        }
    );
builder.Services.AddAuthorization();
builder
    .Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddEntityFrameworkStores<ToDoDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

var app = builder.Build();
await InitializeDatabase(app.Services);

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

// Authentication endpoints return cookie-based sessions for the browser client.
var auth = app.MapGroup("/api/auth");
auth.MapGet(
        "/me",
        async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            return user is null
                ? Results.Unauthorized()
                : Results.Ok(new { email = user.Email, language = user.Language });
        }
    )
    .RequireAuthorization();
auth.MapPost(
    "/register",
    async (
        RegisterRequest request,
        UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signIn
    ) =>
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = new ApplicationUser { UserName = email, Email = email };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return Results.BadRequest(new { code = result.Errors.First().Code });
        await signIn.SignInAsync(user, isPersistent: true);
        return Results.Ok(new { email, language = user.Language });
    }
);
auth.MapPost(
    "/login",
    async (
        LoginRequest request,
        SignInManager<ApplicationUser> signIn,
        UserManager<ApplicationUser> users
    ) =>
    {
        var result = await signIn.PasswordSignInAsync(
            request.Email.Trim(),
            request.Password,
            true,
            lockoutOnFailure: false
        );
        if (!result.Succeeded)
            return Results.Unauthorized();
        var user = await users.FindByNameAsync(request.Email.Trim());
        return Results.Ok(
            new { email = user?.Email ?? request.Email.Trim(), language = user?.Language }
        );
    }
);
auth.MapPost(
        "/logout",
        async (SignInManager<ApplicationUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        }
    )
    .RequireAuthorization();
auth.MapPatch(
        "/language",
        async (
            LanguageRequest request,
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> users
        ) =>
        {
            if (request.Language is not ("de" or "en"))
                return Results.BadRequest(new { code = "unsupported_language" });
            var user = await users.GetUserAsync(principal);
            if (user is null)
                return Results.Unauthorized();
            user.Language = request.Language;
            await users.UpdateAsync(user);
            return Results.NoContent();
        }
    )
    .RequireAuthorization();

// All application data belongs to an authenticated local user.
var api = app.MapGroup("/api").RequireAuthorization();
api.MapGet(
    "/lists",
    async (ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var userId = user.Id();
        var lists = await db
            .Lists.AsNoTracking()
            .Include(x => x.Tasks)
            .Include(x => x.Members)
                .ThenInclude(x => x.User)
            .Where(x => x.OwnerId == userId || x.Members.Any(m => m.UserId == userId))
            .OrderBy(x => x.Name)
            .ToListAsync();
        return Results.Ok(lists.Select(x => x.ToDto(userId)));
    }
);
api.MapPost(
    "/lists",
    async (CreateList request, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { code = "list_name_required" });
        var list = new ToDoList
        {
            Name = request.Name.Trim(),
            Icon = ListIcons.Normalize(request.Icon),
            OwnerId = user.Id(),
        };
        db.Lists.Add(list);
        await db.SaveChangesAsync();
        return Results.Created($"/api/lists/{list.Id}", list.ToDto(user.Id()));
    }
);
api.MapPatch(
    "/lists/{id:guid}",
    async (Guid id, UpdateList request, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var list = await db.Lists.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == id);
        if (list is null)
            return Results.NotFound();
        if (!list.CanEdit(user.Id()))
            return Results.Forbid();
        if (!string.IsNullOrWhiteSpace(request.Name))
            list.Name = request.Name.Trim();
        if (request.Icon is not null)
            list.Icon = ListIcons.Normalize(request.Icon);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
);
api.MapDelete(
    "/lists/{id:guid}",
    async (Guid id, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var list = await db.Lists.FindAsync(id);
        if (list is null)
            return Results.NotFound();
        if (list.OwnerId != user.Id())
            return Results.Forbid();
        db.Lists.Remove(list);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
);
api.MapDelete(
    "/lists/{id:guid}/completed-tasks",
    async (Guid id, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var list = await db
            .Lists.Include(x => x.Members)
            .Include(x => x.Tasks)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (list is null)
            return Results.NotFound();
        if (!list.CanEdit(user.Id()))
            return Results.Forbid();
        var parentIds = list
            .Tasks.Where(x => x.ParentId is not null)
            .Select(x => x.ParentId!.Value)
            .ToHashSet();
        var completed = list.Tasks.Where(x => x.Done && !parentIds.Contains(x.Id)).ToList();
        if (completed.Count == 0)
            return Results.Ok(new { deleted = 0 });
        db.Tasks.RemoveRange(completed);
        await db.SaveChangesAsync();
        return Results.Ok(new { deleted = completed.Count });
    }
);
api.MapPost(
    "/lists/{id:guid}/members",
    async (
        Guid id,
        ShareRequest request,
        ToDoDbContext db,
        UserManager<ApplicationUser> users,
        ClaimsPrincipal user
    ) =>
    {
        var list = await db
            .Lists.Include(x => x.Members)
                .ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (list is null)
            return Results.NotFound();
        if (list.OwnerId != user.Id())
            return Results.Forbid();
        var email = request.Email.Trim().ToLowerInvariant();
        var member = await users.FindByEmailAsync(email);
        if (member is null)
            return Results.BadRequest(new { code = "member_not_found" });
        if (member.Id == list.OwnerId || list.Members.Any(x => x.UserId == member.Id))
            return Results.Conflict(new { code = "member_has_access" });
        list.Members.Add(new ListMember { UserId = member.Id, Role = "editor" });
        await db.SaveChangesAsync();
        return Results.Ok(list.ToDto(user.Id()));
    }
);
api.MapDelete(
    "/lists/{id:guid}/members/{memberId}",
    async (Guid id, string memberId, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var list = await db.Lists.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == id);
        if (list is null)
            return Results.NotFound();
        if (list.OwnerId != user.Id())
            return Results.Forbid();
        var member = list.Members.FirstOrDefault(x => x.UserId == memberId);
        if (member is null)
            return Results.NotFound();
        db.ListMembers.Remove(member);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
);
api.MapPost(
    "/lists/{listId:guid}/tasks",
    async (Guid listId, CreateTask request, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Results.BadRequest(new { code = "task_title_required" });
        var list = await db.Lists.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == listId);
        if (list is null)
            return Results.NotFound();
        if (!list.CanEdit(user.Id()))
            return Results.Forbid();
        if (request.ParentId is not null)
        {
            var parent = await db.Tasks.FirstOrDefaultAsync(x =>
                x.Id == request.ParentId && x.ListId == listId
            );
            if (parent is null)
                return Results.BadRequest(new { code = "invalid_parent_task" });
            parent.Done = false;
        }
        var task = new ToDoTask
        {
            ListId = listId,
            ParentId = request.ParentId,
            Title = request.Title.Trim(),
            DueDate = request.DueDate,
            Notes = request.Notes,
            Repeat = request.Repeat,
        };
        db.Tasks.Add(task);
        await db.SaveChangesAsync();
        return Results.Created($"/api/tasks/{task.Id}", task.ToDto());
    }
);
api.MapPatch(
    "/tasks/{id:guid}",
    async (Guid id, UpdateTask request, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var task = await db
            .Tasks.Include(x => x.List)
                .ThenInclude(x => x!.Members)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (task is null)
            return Results.NotFound();
        if (!task.List!.CanEdit(user.Id()))
            return Results.Forbid();
        if (request.Done == true && await db.Tasks.AnyAsync(x => x.ParentId == id && !x.Done))
            return Results.Conflict(new { code = "complete_subtasks_first" });
        if (!string.IsNullOrWhiteSpace(request.Title))
            task.Title = request.Title.Trim();
        if (request.Done is not null)
            task.Done = request.Done.Value;
        if (request.Done == false && task.ParentId is not null)
        {
            var parent = await db.Tasks.FindAsync(task.ParentId.Value);
            if (parent is not null)
                parent.Done = false;
        }
        if (request.IsStarred is not null)
            task.IsStarred = request.IsStarred.Value;
        task.DueDate = request.ClearDueDate ? null : request.DueDate ?? task.DueDate;
        task.Notes = request.Notes ?? task.Notes;
        task.Repeat = request.Repeat ?? task.Repeat;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
);
api.MapDelete(
    "/tasks/{id:guid}",
    async (Guid id, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        var task = await db
            .Tasks.Include(x => x.List)
                .ThenInclude(x => x!.Members)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (task is null)
            return Results.NotFound();
        if (!task.List!.CanEdit(user.Id()))
            return Results.Forbid();
        if (await db.Tasks.AnyAsync(x => x.ParentId == id))
            return Results.Conflict(new { code = "task_has_subtasks" });
        db.Tasks.Remove(task);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
);
api.MapPost(
    "/import/microsoft",
    async (JsonElement document, ToDoDbContext db, ClaimsPrincipal user) =>
    {
        try
        {
            return Results.Ok(await MicrosoftTodoImporter.ImportAsync(document, user.Id(), db));
        }
        catch (InvalidDataException)
        {
            return Results.BadRequest(new { code = "invalid_microsoft_export" });
        }
    }
);

app.Run();

// EnsureCreated keeps the first deployment simple. The idempotent SQL statements
// below upgrade existing Docker volumes created by earlier application versions.
static async Task InitializeDatabase(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ToDoDbContext>();

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await db.Database.EnsureCreatedAsync();
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Tasks\" ADD COLUMN IF NOT EXISTS \"IsStarred\" boolean NOT NULL DEFAULT FALSE"
            );
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Lists\" ADD COLUMN IF NOT EXISTS \"ExternalSource\" text"
            );
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Lists\" ADD COLUMN IF NOT EXISTS \"ExternalId\" text"
            );
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Tasks\" ADD COLUMN IF NOT EXISTS \"ExternalSource\" text"
            );
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Tasks\" ADD COLUMN IF NOT EXISTS \"ExternalId\" text"
            );
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"AspNetUsers\" ADD COLUMN IF NOT EXISTS \"Language\" character varying(5)"
            );
            await db.Database.ExecuteSqlRawAsync(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Lists_ExternalImport\" ON \"Lists\" (\"OwnerId\", \"ExternalSource\", \"ExternalId\")"
            );
            await db.Database.ExecuteSqlRawAsync(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Tasks_ExternalImport\" ON \"Tasks\" (\"ListId\", \"ExternalSource\", \"ExternalId\")"
            );
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE \"Tasks\" AS parent SET \"Done\" = FALSE WHERE parent.\"Done\" = TRUE AND EXISTS (SELECT 1 FROM \"Tasks\" AS child WHERE child.\"ParentId\" = parent.\"Id\" AND child.\"Done\" = FALSE)"
            );
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE \"Tasks\" SET \"Repeat\" = CASE \"Repeat\" WHEN 'Täglich' THEN 'daily' WHEN 'Wöchentlich' THEN 'weekly' WHEN 'Monatlich' THEN 'monthly' WHEN 'Jährlich' THEN 'yearly' ELSE \"Repeat\" END"
            );
            return;
        }
        catch (Npgsql.NpgsqlException) when (attempt < 10)
        {
            // PostgreSQL may still be starting even after the container health check.
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }
}

// Request contracts deliberately contain only fields writable by clients.
record RegisterRequest(string Email, string Password);

record LoginRequest(string Email, string Password);

record LanguageRequest(string Language);

record CreateList(string Name, string? Icon);

record UpdateList(string? Name, string? Icon);

record ShareRequest(string Email);

record CreateTask(string Title, Guid? ParentId, DateOnly? DueDate, string? Notes, string? Repeat);

record UpdateTask(
    string? Title,
    bool? Done,
    bool? IsStarred,
    DateOnly? DueDate,
    bool ClearDueDate,
    string? Notes,
    string? Repeat
);

sealed class ApplicationUser : IdentityUser
{
    // Null means that the browser language should be used automatically.
    public string? Language { get; set; }
}

sealed class ToDoDbContext(DbContextOptions<ToDoDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<ToDoList> Lists => Set<ToDoList>();
    public DbSet<ToDoTask> Tasks => Set<ToDoTask>();
    public DbSet<ListMember> ListMembers => Set<ListMember>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder
            .Entity<ToDoList>()
            .HasMany(list => list.Tasks)
            .WithOne(task => task.List!)
            .HasForeignKey(task => task.ListId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder
            .Entity<ToDoList>()
            .HasMany(list => list.Members)
            .WithOne(member => member.List!)
            .HasForeignKey(member => member.ListId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder
            .Entity<ToDoList>()
            .HasIndex(list => new
            {
                list.OwnerId,
                list.ExternalSource,
                list.ExternalId,
            })
            .IsUnique()
            .HasDatabaseName("IX_Lists_ExternalImport");

        modelBuilder
            .Entity<ListMember>()
            .HasIndex(member => new { member.ListId, member.UserId })
            .IsUnique();

        modelBuilder
            .Entity<ToDoTask>()
            .HasOne(task => task.Parent)
            .WithMany()
            .HasForeignKey(task => task.ParentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder
            .Entity<ToDoTask>()
            .HasIndex(task => new
            {
                task.ListId,
                task.ExternalSource,
                task.ExternalId,
            })
            .IsUnique()
            .HasDatabaseName("IX_Tasks_ExternalImport");
    }
}

// Database entities stay independent from the JSON response shape.
sealed class ToDoList
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string Icon { get; set; } = "📝";
    public required string OwnerId { get; set; }
    public string? ExternalSource { get; set; }
    public string? ExternalId { get; set; }
    public List<ToDoTask> Tasks { get; set; } = [];
    public List<ListMember> Members { get; set; } = [];

    public bool CanEdit(string userId) =>
        OwnerId == userId || Members.Any(member => member.UserId == userId);

    public ListDto ToDto(string userId) =>
        new(
            Id,
            Name,
            Icon,
            Tasks.OrderBy(task => task.CreatedAt).Select(task => task.ToDto()).ToList(),
            OwnerId == userId,
            Members
                .Select(member => new MemberDto(member.UserId, member.User?.Email ?? ""))
                .ToList()
        );
}

sealed class ToDoTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ListId { get; set; }
    public ToDoList? List { get; set; }
    public Guid? ParentId { get; set; }
    public ToDoTask? Parent { get; set; }
    public required string Title { get; set; }
    public bool Done { get; set; }
    public bool IsStarred { get; set; }
    public DateOnly? DueDate { get; set; }
    public string? Notes { get; set; }
    public string? Repeat { get; set; }
    public string? ExternalSource { get; set; }
    public string? ExternalId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TaskDto ToDto() => new(Id, Title, Done, IsStarred, DueDate, Notes, Repeat, ParentId);
}

sealed class ListMember
{
    public int Id { get; set; }
    public Guid ListId { get; set; }
    public ToDoList? List { get; set; }
    public required string UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public string Role { get; set; } = "editor";
}

record ListDto(
    Guid Id,
    string Name,
    string Icon,
    List<TaskDto> Tasks,
    bool IsOwner,
    List<MemberDto> Members
);

record TaskDto(
    Guid Id,
    string Title,
    bool Done,
    bool IsStarred,
    DateOnly? DueDate,
    string? Notes,
    string? Repeat,
    Guid? ParentId
);

record MemberDto(string Id, string Email);

static class UserExtensions
{
    public static string Id(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)!;
}

static class ListIcons
{
    private static readonly HashSet<string> Allowed =
    [
        "📝",
        "🛒",
        "🏠",
        "💼",
        "🎒",
        "✈️",
        "🎁",
        "🍽️",
        "🌱",
        "🔧",
        "💡",
        "❤️",
    ];

    public static string Normalize(string? icon) =>
        icon is not null && Allowed.Contains(icon) ? icon : "📝";
}

// Converts the neutral JSON produced by the Bash exporter into local entities.
// External IDs make the operation idempotent, while a transaction prevents partial imports.
static class MicrosoftTodoImporter
{
    private const string Source = "microsoft-todo";

    public static async Task<ImportResult> ImportAsync(
        JsonElement document,
        string ownerId,
        ToDoDbContext db
    )
    {
        if (
            document.ValueKind != JsonValueKind.Object
            || !document.TryGetProperty("format", out var format)
            || format.GetString() != "todo-microsoft-export"
            || !document.TryGetProperty("lists", out var exportedLists)
            || exportedLists.ValueKind != JsonValueKind.Array
        )
            throw new InvalidDataException("Unsupported Microsoft To Do export format.");

        var importedLists = 0;
        var createdTasks = 0;
        var updatedTasks = 0;
        await using var transaction = await db.Database.BeginTransactionAsync();

        foreach (var exportedList in exportedLists.EnumerateArray())
        {
            var microsoftListId = Text(exportedList, "id");
            if (string.IsNullOrWhiteSpace(microsoftListId))
                continue;
            var externalListId = $"list:{microsoftListId}";
            var list = await db
                .Lists.Include(x => x.Tasks)
                .FirstOrDefaultAsync(x =>
                    x.OwnerId == ownerId
                    && x.ExternalSource == Source
                    && x.ExternalId == externalListId
                );

            if (list is null)
            {
                var name = Text(exportedList, "displayName") ?? "Imported list";
                list = new ToDoList
                {
                    OwnerId = ownerId,
                    Name = name,
                    Icon = IconFor(name),
                    ExternalSource = Source,
                    ExternalId = externalListId,
                };
                db.Lists.Add(list);
            }
            else if (!string.IsNullOrWhiteSpace(Text(exportedList, "displayName")))
            {
                list.Name = Text(exportedList, "displayName")!;
            }

            if (
                exportedList.TryGetProperty("tasks", out var tasks)
                && tasks.ValueKind == JsonValueKind.Array
            )
            {
                foreach (var exportedTask in tasks.EnumerateArray())
                {
                    var microsoftTaskId = Text(exportedTask, "id");
                    if (string.IsNullOrWhiteSpace(microsoftTaskId))
                        continue;
                    var (task, created) = UpsertTask(
                        list,
                        $"task:{microsoftTaskId}",
                        null,
                        exportedTask,
                        false
                    );
                    if (created)
                        createdTasks++;
                    else
                        updatedTasks++;

                    if (
                        exportedTask.TryGetProperty("checklistItems", out var checklist)
                        && checklist.ValueKind == JsonValueKind.Array
                    )
                    {
                        foreach (var exportedItem in checklist.EnumerateArray())
                        {
                            var itemId = Text(exportedItem, "id");
                            if (string.IsNullOrWhiteSpace(itemId))
                                continue;
                            var (_, itemCreated) = UpsertTask(
                                list,
                                $"checklist:{microsoftTaskId}:{itemId}",
                                task.Id,
                                exportedItem,
                                true
                            );
                            if (itemCreated)
                                createdTasks++;
                            else
                                updatedTasks++;
                        }
                    }
                    if (task.Done && list.Tasks.Any(x => x.ParentId == task.Id && !x.Done))
                        task.Done = false;
                }
            }
            importedLists++;
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return new ImportResult(importedLists, createdTasks, updatedTasks);
    }

    private static (ToDoTask Task, bool Created) UpsertTask(
        ToDoList list,
        string externalId,
        Guid? parentId,
        JsonElement source,
        bool checklistItem
    )
    {
        var task = list.Tasks.FirstOrDefault(x =>
            x.ExternalSource == Source && x.ExternalId == externalId
        );
        var created = task is null;
        if (task is null)
        {
            task = new ToDoTask
            {
                ListId = list.Id,
                Title = "Imported task",
                ExternalSource = Source,
                ExternalId = externalId,
            };
            list.Tasks.Add(task);
        }

        task.ParentId = parentId;
        task.Title = (
            Text(source, checklistItem ? "displayName" : "title") ?? "Imported task"
        ).Trim();
        task.Done = checklistItem
            ? Boolean(source, "isChecked")
            : string.Equals(
                Text(source, "status"),
                "completed",
                StringComparison.OrdinalIgnoreCase
            );
        task.IsStarred =
            !checklistItem
            && string.Equals(
                Text(source, "importance"),
                "high",
                StringComparison.OrdinalIgnoreCase
            );
        if (!checklistItem)
        {
            task.DueDate = DueDate(source);
            task.Notes = NestedText(source, "body", "content");
            task.Repeat = Repeat(source);
        }
        return (task, created);
    }

    private static string? Text(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static bool Boolean(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True;

    private static string? NestedText(JsonElement element, string parent, string property) =>
        element.TryGetProperty(parent, out var nested) && nested.ValueKind == JsonValueKind.Object
            ? Text(nested, property)
            : null;

    private static DateOnly? DueDate(JsonElement task)
    {
        var dateTime = NestedText(task, "dueDateTime", "dateTime");
        return
            dateTime is not null
            && dateTime.Length >= 10
            && DateOnly.TryParse(dateTime[..10], out var date)
            ? date
            : null;
    }

    private static string? Repeat(JsonElement task)
    {
        if (
            !task.TryGetProperty("recurrence", out var recurrence)
            || recurrence.ValueKind != JsonValueKind.Object
            || !recurrence.TryGetProperty("pattern", out var pattern)
            || pattern.ValueKind != JsonValueKind.Object
        )
            return null;
        return Text(pattern, "type")?.ToLowerInvariant() switch
        {
            "daily" => "daily",
            "weekly" => "weekly",
            "absolutemonthly" or "relativemonthly" => "monthly",
            "absoluteyearly" or "relativeyearly" => "yearly",
            _ => null,
        };
    }

    private static string IconFor(string name)
    {
        var value = name.ToLowerInvariant();
        if (value.Contains("einkauf") || value.Contains("shopping"))
            return "🛒";
        if (value.Contains("reise") || value.Contains("travel") || value.Contains("urlaub"))
            return "✈️";
        if (value.Contains("arbeit") || value.Contains("work"))
            return "💼";
        if (value.Contains("haus") || value.Contains("home"))
            return "🏠";
        return "📝";
    }
}

record ImportResult(int Lists, int CreatedTasks, int UpdatedTasks);
