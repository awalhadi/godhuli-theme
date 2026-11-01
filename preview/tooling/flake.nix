{
  description = "Godhuli Shop — development environment and packages";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ (import rust-overlay) ];
          config.allowUnfree = false;
        };
        nodejs = pkgs.nodejs_22;
        version = "2.4.1";

        # Helper: wrap a script with the shop's runtime deps on PATH
        mkScript = name: text: pkgs.writeShellScriptBin name ''
          export PATH=${pkgs.lib.makeBinPath [ nodejs pkgs.postgresql_16 ]}:$PATH
          ${text}
        '';
      in
      {
        packages = rec {
          shop-api = pkgs.buildNpmPackage {
            pname = "godhuli-shop-api";
            inherit version;
            src = ./.;
            npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
            nodejs = nodejs;
            doCheck = true;
            meta = with pkgs.lib; {
              description = "Order API for Godhuli Shop";
              license = licenses.mit;
              platforms = platforms.linux ++ platforms.darwin;
            };
          };
          default = shop-api;
        };

        apps.seed = flake-utils.lib.mkApp {
          drv = mkScript "seed" "psql \"$DATABASE_URL\" -f data/reports.sql";
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            pnpm
            postgresql_16
            redis
            rust-bin.stable.latest.default
          ] ++ lib.optionals stdenv.isDarwin [ darwin.apple_sdk.frameworks.Security ];

          DATABASE_URL = "postgres://shop:shop@localhost:5432/shop";
          shellHook = ''
            echo "🌅 Godhuli Shop dev shell (node $(node --version))"
          '';
        };
      });
}
