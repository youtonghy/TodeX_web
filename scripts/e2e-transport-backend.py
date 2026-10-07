#!/usr/bin/env python3
"""Start/stop a throwaway TodeX backend for the transport v2 browser test.

The backend listens on 0.0.0.0 with `pairing_encryption = "ml-kem-768"`,
temporary state, fake Codex/Claude CLIs and no enrolled devices, so the test
must pair with device pairing v3, which also delivers and verifies the
backend's ML-KEM transport key (nothing is imported by hand). Reach it through
this machine's LAN address: the peer is then non-loopback and the backend only
accepts transport v2.

    start --backend-binary <todex-agentd> --fake-provider <fake_provider.py> --port <free port>
    approve --fixture <root>          # approves the pending pairing request
    stop --fixture <root>

`start` prints the fixture JSON (root, url, lanUrl, transport key); the
Playwright spec `tests/e2e/transport-v2.spec.ts` reads it from
`TODEX_E2E_TRANSPORT_FIXTURE`. Never point this at the user's :7345 daemon.
"""
import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request


def environment(root):
    home = root / "home"
    return {
        "HOME": str(home), "USER": "fixture", "LOGNAME": "fixture", "SHELL": "/bin/sh",
        "PATH": str(root / "bin") + ":/usr/bin:/bin:/usr/sbin:/sbin",
        "TMPDIR": str(root / "tmp") + "/", "LANG": "en_US.UTF-8", "TERM": "xterm-256color",
        "CODEX_HOME": str(home / ".codex"), "CLAUDE_CONFIG_DIR": str(home / ".claude"),
        "XDG_CONFIG_HOME": str(home / ".config"), "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": str(home / ".gitconfig"), "GIT_TERMINAL_PROMPT": "0",
        "NO_PROXY": "*", "RUST_LOG": "todex_agentd=info",
    }


def lan_address():
    for interface in ("en0", "en1"):
        result = subprocess.run(["ipconfig", "getifaddr", interface], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    raise RuntimeError("no LAN IPv4 address; the test needs a non-loopback peer")


def start(binary, fake_provider, port):
    if port == 7345:
        raise ValueError("refusing to use the live daemon's port 7345")
    binary, fake_provider = Path(binary).resolve(), Path(fake_provider).resolve()
    root = Path(tempfile.mkdtemp(prefix="todex-e2e-v2-", dir="/tmp")).resolve()
    for directory in ("home/.codex", "home/.claude", "home/.config", "tmp", "bin", "logs", "data", "workspaces/project"):
        (root / directory).mkdir(parents=True, exist_ok=True)
    shutil.copy2(fake_provider, root / "bin/fake_provider.py")
    for provider in ("codex", "claude"):
        launcher = root / "bin" / provider
        launcher.write_text("#!/bin/sh\nexec " + shlex.quote(sys.executable) + " "
                            + shlex.quote(str(root / "bin/fake_provider.py")) + " " + provider + ' "$@"\n')
        launcher.chmod(0o700)
    env = environment(root)
    (root / "home/.gitconfig").write_text("[user]\n name = TodeX E2E\n email = e2e@example.invalid\n[commit]\n gpgsign = false\n")
    workspace = root / "workspaces/project"
    (workspace / "README.md").write_text("# transport v2 e2e\n")
    for args in (["init", "--initial-branch=main"], ["add", "."], ["commit", "-m", "init"]):
        subprocess.run(["/usr/bin/git", "-C", str(workspace), *args], env=env, check=True, capture_output=True)
    quote = json.dumps
    config = "\n".join([
        'host = "0.0.0.0"', f"port = {port}", 'pairing_encryption = "ml-kem-768"',
        "workspace_root = " + quote(str(root / "workspaces")),
        "[agent]", 'default_agent = "codex"',
        "codex_bin = " + quote(str(root / "bin/codex")), "claude_bin = " + quote(str(root / "bin/claude")),
        "pi_bin = " + quote(str(root / "bin/unavailable-pi")), "grok_bin = " + quote(str(root / "bin/unavailable-grok")),
        "[security]", "enable_auth = true", "enable_tls = false", "",
    ])
    (root / "data/config.toml").write_text(config)
    (root / "data/config.toml").chmod(0o600)
    command = [str(binary), "daemon-run", "--host", "0.0.0.0", "--port", str(port),
               "--data-dir", str(root / "data"), "--workspace-root", str(root / "workspaces")]
    with (root / "logs/backend.log").open("ab") as log:
        child = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                 start_new_session=True)
    url = f"http://127.0.0.1:{port}"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 60
    while True:
        if child.poll() is not None:
            raise RuntimeError("backend exited: " + (root / "logs/backend.log").read_text()[-4000:])
        try:
            with opener.open(url + "/health", timeout=1) as response:
                if response.read() == b"ok":
                    break
        except OSError:
            pass
        if time.monotonic() > deadline:
            child.terminate()
            raise TimeoutError("backend did not start; see " + str(root / "logs/backend.log"))
        time.sleep(0.2)
    keys = json.loads((root / "data/pairing_keys.json").read_text())
    lan_url = f"http://{lan_address()}:{port}"
    # Only for assertions: the browser must learn this key from device pairing.
    manifest = {"kind": "todex-web-e2e-transport-v2", "root": str(root), "pid": child.pid, "url": url,
                "lanUrl": lan_url, "workspace": str(workspace), "dataDir": str(root / "data"),
                "transportPublicKey": keys["mlKemPublic"]}
    (root / "fixture.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def owned(root):
    root = Path(root).resolve()
    manifest = json.loads((root / "fixture.json").read_text())
    if manifest.get("kind") != "todex-web-e2e-transport-v2" or manifest.get("root") != str(root):
        raise ValueError("not an e2e transport fixture")
    return root, manifest


def approve(root):
    root, manifest = owned(root)
    directory = Path(manifest["dataDir"]) / "device-pairing"
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        requests = sorted(directory.glob("request-*.json")) if directory.exists() else []
        pending = [path for path in requests if not (directory / path.name.replace("request-", "decision-")).exists()]
        if pending:
            summary = json.loads(pending[0].read_text())
            decision = directory / f"decision-{summary['requestId']}.json"
            fd = os.open(decision, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as handle:
                json.dump({"requestId": summary["requestId"], "approved": True}, handle)
            return summary
        time.sleep(0.2)
    raise TimeoutError("no pending pairing request")


def stop(root):
    root, manifest = owned(root)
    try:
        os.kill(manifest["pid"], signal.SIGTERM)
    except ProcessLookupError:
        pass
    return {"stopped": manifest["pid"], "root": str(root)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    starter = commands.add_parser("start")
    starter.add_argument("--backend-binary", required=True)
    starter.add_argument("--fake-provider", required=True)
    starter.add_argument("--port", type=int, required=True)
    for name in ("approve", "stop"):
        commands.add_parser(name).add_argument("--fixture", required=True)
    args = parser.parse_args()
    if args.command == "start":
        result = start(args.backend_binary, args.fake_provider, args.port)
    elif args.command == "approve":
        result = approve(args.fixture)
    else:
        result = stop(args.fixture)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
