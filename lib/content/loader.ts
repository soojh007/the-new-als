import { ContentPackage } from "../types/als.ts";
import { AVAILABLE_PACKAGES, getPackageById } from "./packages.ts";

/**
 * Validates the internal consistency and referential integrity of a ContentPackage.
 */
export function validateContentPackage(pkg: ContentPackage): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!pkg.id || !pkg.title || !pkg.subject) {
    errors.push("Package metadata missing id, title, or subject");
  }

  const skillIds = new Set(pkg.skills.map((s) => s.id));
  const kuIds = new Set(pkg.curriculum.map((k) => k.ku));

  // Check curriculum skills exist
  pkg.curriculum.forEach((ku) => {
    ku.skills.forEach((skillId) => {
      if (!skillIds.has(skillId)) {
        errors.push(`Knowledge Unit "${ku.ku}" references missing skill "${skillId}"`);
      }
    });
  });

  // Check item references
  pkg.items.forEach((item) => {
    if (!kuIds.has(item.ku)) {
      errors.push(`Item "${item.id}" references missing Knowledge Unit "${item.ku}"`);
    }
    if (!skillIds.has(item.skill)) {
      errors.push(`Item "${item.id}" references missing Skill "${item.skill}"`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function loadContentPackage(packageId: string): ContentPackage {
  return getPackageById(packageId);
}

export function listAvailablePackages(): { id: string; subject: string; title: string; level: string }[] {
  return AVAILABLE_PACKAGES.map((pkg) => ({
    id: pkg.id,
    subject: pkg.subject,
    title: pkg.title,
    level: pkg.level,
  }));
}
