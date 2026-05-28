import { describe, it, expect } from "vitest";

import { resolvePath, vvizDir } from "../viz-engine/path-resolver";

describe("vvizDir", () => {
  it("extrait le dossier d'un chemin POSIX", () => {
    expect(vvizDir("/home/x/y.vviz")).toBe("/home/x");
  });
  it("extrait le dossier d'un chemin Windows lettre de lecteur", () => {
    expect(vvizDir("C:/Users/x/y.vviz")).toBe("C:/Users/x");
  });
  it("extrait le dossier d'un chemin UNC", () => {
    expect(vvizDir("//share/dir/y.vviz")).toBe("//share/dir");
  });
  it("normalise les antislashes Windows", () => {
    expect(vvizDir("C:\\Users\\x\\y.vviz")).toBe("C:/Users/x");
  });
  it("retourne '.' si pas de séparateur", () => {
    expect(vvizDir("y.vviz")).toBe(".");
  });
});

describe("resolvePath — chemins absolus", () => {
  it("renvoie tel quel un chemin UNC", () => {
    expect(resolvePath("//host/share/x.parquet", "/anywhere"))
      .toBe("//host/share/x.parquet");
  });
  it("renvoie tel quel un chemin avec lettre de lecteur", () => {
    expect(resolvePath("Z:/data/x.parquet", "/anywhere"))
      .toBe("Z:/data/x.parquet");
  });
  it("renvoie tel quel un chemin absolu POSIX", () => {
    expect(resolvePath("/abs/x.parquet", "/anywhere"))
      .toBe("/abs/x.parquet");
  });
});

describe("resolvePath — chemins relatifs", () => {
  it("résout ./x.parquet par rapport au dossier du .vviz", () => {
    expect(resolvePath("./x.parquet", "/home/dash"))
      .toBe("/home/dash/x.parquet");
  });
  it("résout x.parquet (sans ./) par rapport au dossier du .vviz", () => {
    expect(resolvePath("x.parquet", "/home/dash"))
      .toBe("/home/dash/x.parquet");
  });
  it("résout ../x.parquet en remontant d'un niveau", () => {
    expect(resolvePath("../x.parquet", "/home/dash"))
      .toBe("/home/x.parquet");
  });
  it("résout des chemins multi-niveaux relatifs", () => {
    expect(resolvePath("./data/sub/x.parquet", "/home/dash"))
      .toBe("/home/dash/data/sub/x.parquet");
  });
  it("normalise les antislashes côté chemin déclaré", () => {
    expect(resolvePath(".\\data\\x.parquet", "C:/Users/x"))
      .toBe("C:/Users/x/data/x.parquet");
  });
  it("résout en préservant le préfixe UNC du dossier", () => {
    expect(resolvePath("./x.parquet", "//share/dashboards"))
      .toBe("//share/dashboards/x.parquet");
  });
});
