using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using OnMe.Api.Models;

namespace OnMe.Api.Services;

public class TokenService(IConfiguration config)
{
    public string CreateToken(ApplicationUser user, IList<string> roles)
    {
        var jwt = config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? user.Email ?? ""),
            new(ClaimTypes.Email, user.Email ?? ""),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
