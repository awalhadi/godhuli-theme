//! Godhuli stress sample — Rust.
//! Check: lifetimes, macros!, #[attributes], traits vs structs, `unsafe` stands out.

use std::collections::HashMap;
use std::fmt::{self, Display};

/// A borrowed view over a log line.
#[derive(Debug, Clone, PartialEq)]
pub struct Entry<'a> {
    pub level: Level,
    pub message: &'a str,
    fields: HashMap<&'a str, &'a str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Level {
    Error,
    Warn,
    Info,
}

pub trait Render {
    const PREFIX: &'static str = ">>";
    fn render(&self, out: &mut impl fmt::Write) -> fmt::Result;
}

impl<'a> Entry<'a> {
    pub fn parse(line: &'a str) -> Option<Self> {
        let (level, rest) = line.split_once(' ')?;
        let level = match level {
            "ERROR" => Level::Error,
            "WARN" => Level::Warn,
            _ => Level::Info,
        };
        Some(Self { level, message: rest.trim(), fields: HashMap::new() })
    }
}

impl Display for Entry<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}] {} ({} fields)", self.level, self.message, self.fields.len())
    }
}

macro_rules! entries {
    ($($line:expr),* $(,)?) => { vec![$(Entry::parse($line)),*] };
}

fn main() {
    let logs = entries!["ERROR disk full", "WARN 90% used", "INFO ok"];
    let raw: *const u8 = logs.as_ptr().cast();
    let first = unsafe { *raw };
    for entry in logs.iter().flatten().filter(|e| e.level != Level::Info) {
        println!("{entry} {first:#04x} {}", 1_000_u32 as f64 / 3.0);
    }
}
